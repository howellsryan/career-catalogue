// Read the shared daily fact. Retrieval and retries never trigger generation.
(function () {
  'use strict';
  var panel = document.getElementById('daily-fact');
  if (!panel) return;

  var state = document.getElementById('fact-state');
  var stateTitle = document.getElementById('fact-state-title');
  var stateDescription = document.getElementById('fact-state-description');
  var article = document.getElementById('fact-content');
  var retry = document.getElementById('fact-retry');
  var copy = document.getElementById('fact-copy');
  var announcement = document.getElementById('fact-announcement');
  var categories = {
    news: 'World news', history: 'History', science: 'Science', nature: 'Nature',
    sport: 'Sport', human: 'Human life', technology: 'Technology', culture: 'Culture', other: 'Discovery'
  };
  var select = document.getElementById('fact-history');
  var today = document.getElementById('fact-today');
  var earlier = document.getElementById('fact-earlier');
  var historyStatus = document.getElementById('fact-history-status');
  var archiveEndpoint = new URL(panel.dataset.endpoint);
  archiveEndpoint.pathname = archiveEndpoint.pathname.replace(/\/fact$/, '/facts');
  archiveEndpoint.search = '';
  var selectedDate = '';
  var sequence = 0;
  var activeRequest = null;
  var historyBusy = false;
  var nextBefore = null;
  var historyFailed = false;
  var knownDates = new Set();
  var currentFact = null;

  function showState(title, description, canRetry) {
    article.hidden = true;
    state.hidden = false;
    stateTitle.textContent = title;
    stateDescription.textContent = description;
    retry.hidden = !canRetry;
    announcement.textContent = title + '. ' + description;
  }

  function validFact(data) {
    if (!data || data.schema_version !== 1 || !Object.prototype.hasOwnProperty.call(categories, data.category)) return false;
    var limits = { title: 200, fact: 2000, explanation: 1500 };
    if (!Object.keys(limits).every(function (key) {
      return typeof data[key] === 'string' && data[key].trim().length > 0 && data[key].length <= limits[key];
    })) return false;
    return validDate(data.fact_date);
  }

  function render(data) {
    document.getElementById('fact-category').textContent = categories[data.category];
    document.getElementById('fact-title').textContent = data.title;
    document.getElementById('fact-text').textContent = data.fact;
    document.getElementById('fact-explanation').textContent = data.explanation;
    var date = document.getElementById('fact-date');
    date.dateTime = data.fact_date;
    date.textContent = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(data.fact_date + 'T00:00:00Z'));
    state.hidden = true;
    article.hidden = false;
    currentFact = data;
    copy.hidden = !(navigator.clipboard && window.isSecureContext);
    announcement.textContent = 'Daily fact loaded: ' + data.title;
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function dateLabel(day) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(day + 'T00:00:00Z'));
  }

  function syncControls() {
    today.setAttribute('aria-pressed', String(!selectedDate));
    if (selectedDate && validDate(selectedDate) && !Array.from(select.options).some(function (option) { return option.value === selectedDate; })) {
      var option = document.createElement('option');
      option.value = selectedDate;
      option.textContent = dateLabel(selectedDate);
      select.appendChild(option);
    }
    select.value = validDate(selectedDate) ? selectedDate : '';
  }

  function navigate(day) {
    var url = new URL(window.location.href);
    if (day) url.searchParams.set('date', day);
    else url.searchParams.delete('date');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    loadFact(day);
  }

  async function loadFact(day) {
    selectedDate = day || '';
    syncControls();
    var requestId = ++sequence;
    if (activeRequest) activeRequest.abort();
    var controller = new AbortController();
    activeRequest = controller;
    currentFact = null;
    document.getElementById('fact-copy-status').textContent = '';
    retry.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    showState('Finding a little wonder', selectedDate ? 'Loading this day’s fact…' : 'Loading the daily fact…', false);
    var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      if (selectedDate && !validDate(selectedDate)) {
        showState('Choose a valid date', 'Use the date selector or return to Today.', false);
        return;
      }
      var response = await fetch(selectedDate ? archiveEndpoint.href + '/' + selectedDate : panel.dataset.endpoint, {
        method: 'GET', mode: 'cors', credentials: 'omit', signal: controller.signal
      });
      if (requestId !== sequence) return;
      if (response.status === 404 && selectedDate) {
        showState('No discovery for this day', 'There isn’t a published fact for this date. Choose another day or return to Today.', false);
        return;
      }
      if (response.status === 503 && !selectedDate) {
        showState('A little wonder is on its way', 'The daily fact hasn’t been published yet. Check back soon.', true);
        return;
      }
      if (!response.ok) throw new Error('Fact request failed');
      var data = await response.json();
      if (requestId !== sequence) return;
      if (!validFact(data) || (selectedDate && data.fact_date !== selectedDate)) throw new Error('Invalid fact response');
      document.getElementById('fact-view').textContent = selectedDate ? 'From the archive' : 'Today’s discovery';
      render(data);
    } catch (error) {
      if (requestId !== sequence) return;
      var timedOut = error.name === 'AbortError';
      showState(timedOut ? 'That took a little too long' : 'We couldn’t load the fact',
        timedOut ? 'The connection timed out. Please try again.' : 'Please check your connection and try again.', true);
    } finally {
      window.clearTimeout(timeout);
      if (requestId === sequence) {
        activeRequest = null;
        retry.disabled = false;
        panel.setAttribute('aria-busy', 'false');
      }
    }
  }

  async function loadHistory() {
    if (historyBusy) return;
    historyBusy = true;
    earlier.disabled = true;
    historyStatus.textContent = 'Loading available dates…';
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      var url = new URL(archiveEndpoint);
      if (nextBefore) url.searchParams.set('before', nextBefore);
      var response = await fetch(url.href, { method: 'GET', mode: 'cors', credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('History request failed');
      var data = await response.json();
      if (!data || data.schema_version !== 1 || !Array.isArray(data.facts) || data.facts.length > 50 ||
          !data.facts.every(function (fact, index) {
            return fact && validDate(fact.fact_date) && fact.id === fact.fact_date &&
              typeof fact.title === 'string' && fact.title.length > 0 && fact.title.length <= 200 &&
              Object.prototype.hasOwnProperty.call(categories, fact.category) &&
              (!nextBefore || fact.fact_date < nextBefore) &&
              (!index || fact.fact_date < data.facts[index - 1].fact_date);
          }) || (data.next_before !== null && (!data.facts.length || data.next_before !== data.facts[data.facts.length - 1].fact_date))) {
        throw new Error('Invalid history response');
      }
      data.facts.forEach(function (fact) {
        if (knownDates.has(fact.fact_date)) return;
        knownDates.add(fact.fact_date);
        var option = Array.from(select.options).find(function (item) { return item.value === fact.fact_date; });
        if (!option) { option = document.createElement('option'); option.value = fact.fact_date; select.appendChild(option); }
        option.textContent = dateLabel(fact.fact_date) + ' · ' + fact.title;
      });
      // Keep dates in order even when a shared link added an option before its page loaded.
      Array.from(select.options).slice(1).sort(function (left, right) { return right.value.localeCompare(left.value); })
        .forEach(function (option) { select.appendChild(option); });
      syncControls();
      nextBefore = data.next_before;
      historyFailed = false;
      earlier.hidden = !nextBefore;
      earlier.textContent = 'Earlier dates';
      historyStatus.textContent = knownDates.size ? knownDates.size + ' published ' + (knownDates.size === 1 ? 'day' : 'days') +
        ' available' + (nextBefore ? ' · Load earlier dates to explore more.' : '.') : 'The archive will begin with the first published fact.';
    } catch (error) {
      historyFailed = true;
      earlier.hidden = false;
      earlier.textContent = 'Retry dates';
      historyStatus.textContent = 'We couldn’t load available dates. You can still read the fact or try again.';
    } finally {
      window.clearTimeout(timeout);
      historyBusy = false;
      earlier.disabled = false;
    }
  }

  retry.addEventListener('click', function () { loadFact(selectedDate); });
  today.addEventListener('click', function () { navigate(''); });
  select.addEventListener('change', function () { navigate(select.value); });
  earlier.addEventListener('click', function () { if (nextBefore || historyFailed) loadHistory(); });
  window.addEventListener('popstate', function () { loadFact(new URL(window.location.href).searchParams.get('date') || ''); });
  copy.addEventListener('click', async function () {
    if (!currentFact) return;
    copy.disabled = true;
    var copySequence = sequence;
    try {
      await navigator.clipboard.writeText(currentFact.title + '\n\n' + currentFact.fact + '\n\n' + currentFact.explanation);
      if (copySequence !== sequence) return;
      document.getElementById('fact-copy-status').textContent = 'Copied to your clipboard.';
    } catch (error) {
      if (copySequence !== sequence) return;
      document.getElementById('fact-copy-status').textContent = 'Couldn’t copy. Select the fact text to copy it manually.';
    } finally {
      copy.disabled = false;
    }
  });
  document.getElementById('fact-browser').hidden = false;
  loadFact(new URL(window.location.href).searchParams.get('date') || '');
  loadHistory();
})();
