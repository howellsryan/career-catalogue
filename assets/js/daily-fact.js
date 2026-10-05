// Browsing stored facts never triggers generation.
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
  var copyStatus = document.getElementById('fact-copy-status');
  var loading = document.getElementById('fact-loading');
  var announcement = document.getElementById('fact-announcement');
  var select = document.getElementById('fact-history');
  var earlier = document.getElementById('fact-earlier');
  var historyStatus = document.getElementById('fact-history-status');
  var categories = {
    news: 'World news', history: 'History', science: 'Science', nature: 'Nature',
    sport: 'Sport', human: 'Human life', technology: 'Technology', culture: 'Culture', other: 'Other'
  };
  var archiveEndpoint = new URL(panel.dataset.endpoint);
  archiveEndpoint.pathname = archiveEndpoint.pathname.replace(/\/fact$/, '/facts');
  archiveEndpoint.search = '';

  var selectedDate = '';
  var latestDate = null;
  var sequence = 0;
  var activeRequest = null;
  var historyBusy = false;
  var nextBefore = null;
  var historyFailed = false;
  var knownDates = new Set();
  var cachedFacts = new Map();
  var currentFact = null;
  var dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validFact(data) {
    if (!data || data.schema_version !== 1 || !Object.prototype.hasOwnProperty.call(categories, data.category)) return false;
    var limits = { title: 200, fact: 2000, explanation: 1500 };
    return Object.keys(limits).every(function (key) {
      return typeof data[key] === 'string' && data[key].trim().length > 0 && data[key].length <= limits[key];
    }) && validDate(data.fact_date);
  }

  function dateLabel(day) { return dateFormatter.format(new Date(day + 'T00:00:00Z')); }

  function isToday(day) {
    return day === latestDate || day === new Date().toISOString().slice(0, 10);
  }

  function syncControls() {
    // Today already represents the latest publication, including a retained previous day.
    var dates = Array.from(knownDates).filter(function (day) { return !isToday(day); });
    if (validDate(selectedDate) && !isToday(selectedDate) && dates.indexOf(selectedDate) === -1) dates.push(selectedDate);
    dates.sort().reverse();
    var options = document.createDocumentFragment();
    var today = document.createElement('option');
    today.value = '';
    today.textContent = 'Today';
    options.appendChild(today);
    dates.forEach(function (day) {
      var option = document.createElement('option');
      option.value = day;
      option.textContent = dateLabel(day);
      options.appendChild(option);
    });
    select.replaceChildren(options);
    select.value = validDate(selectedDate) && !isToday(selectedDate) ? selectedDate : '';
  }

  function showState(title, description, canRetry) {
    currentFact = null;
    article.hidden = true;
    state.hidden = false;
    stateTitle.textContent = title;
    stateDescription.textContent = description;
    retry.hidden = !canRetry;
    announcement.textContent = title + '. ' + description;
  }

  function render(data) {
    document.getElementById('fact-category').textContent = categories[data.category];
    document.getElementById('fact-title').textContent = data.title;
    document.getElementById('fact-text').textContent = data.fact;
    document.getElementById('fact-explanation').textContent = data.explanation;
    var date = document.getElementById('fact-date');
    date.dateTime = data.fact_date;
    date.textContent = dateLabel(data.fact_date);
    if (!selectedDate) latestDate = data.fact_date;
    cachedFacts.set(data.fact_date, data);
    currentFact = data;
    syncControls();
    state.hidden = true;
    article.hidden = false;
    copy.hidden = !(navigator.clipboard && window.isSecureContext);
    announcement.textContent = 'Fact loaded: ' + data.title;
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
    copyStatus.textContent = '';
    copy.disabled = true;
    retry.disabled = true;
    state.hidden = true;
    loading.hidden = true;
    panel.setAttribute('aria-busy', 'true');
    // Leave a loaded article in place. Fast and cached reads need no visible loading state.
    var progress = window.setTimeout(function () {
      if (requestId !== sequence) return;
      loading.textContent = selectedDate && validDate(selectedDate) ? 'Loading ' + dateLabel(selectedDate) + '…' : 'Loading fact…';
      loading.hidden = false;
    }, 250);
    var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      if (selectedDate && !validDate(selectedDate)) {
        showState('Choose a valid date', 'Use the date menu to select a published fact.', false);
        return;
      }
      if (selectedDate && cachedFacts.has(selectedDate)) {
        render(cachedFacts.get(selectedDate));
        return;
      }
      // Latest reads remain fresh; only immutable dated publications are reused in memory.
      var response = await fetch(selectedDate ? archiveEndpoint.href + '/' + selectedDate : panel.dataset.endpoint, {
        method: 'GET', mode: 'cors', credentials: 'omit', signal: controller.signal
      });
      if (requestId !== sequence) return;
      if (response.status === 404 && selectedDate) {
        showState('No fact for this date', 'Choose another date, or select Today for the latest fact.', false);
        return;
      }
      if (response.status === 503 && !selectedDate) {
        showState('Fact unavailable', 'A fact hasn’t been published yet. Try again later.', true);
        return;
      }
      if (!response.ok) throw new Error('Fact request failed');
      var data = await response.json();
      if (requestId !== sequence) return;
      if (!validFact(data) || (selectedDate && data.fact_date !== selectedDate)) throw new Error('Invalid fact response');
      render(data);
    } catch (error) {
      if (requestId !== sequence) return;
      showState(error.name === 'AbortError' ? 'Request timed out' : 'Couldn’t load this fact',
        'Check your connection and try again, or select another date.', true);
    } finally {
      window.clearTimeout(progress);
      window.clearTimeout(timeout);
      if (requestId === sequence) {
        activeRequest = null;
        loading.hidden = true;
        retry.disabled = false;
        copy.disabled = !currentFact;
        panel.setAttribute('aria-busy', 'false');
      }
    }
  }

  async function loadHistory() {
    if (historyBusy) return;
    historyBusy = true;
    earlier.disabled = true;
    historyStatus.textContent = '';
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
      if (!latestDate && !nextBefore && data.facts.length) latestDate = data.facts[0].fact_date;
      data.facts.forEach(function (fact) { knownDates.add(fact.fact_date); });
      syncControls();
      nextBefore = data.next_before;
      historyFailed = false;
      earlier.hidden = !nextBefore;
      earlier.textContent = 'Earlier dates';
      historyStatus.textContent = '';
    } catch (error) {
      historyFailed = true;
      earlier.hidden = false;
      earlier.textContent = 'Retry dates';
      historyStatus.textContent = 'Dates couldn’t be loaded. Try again.';
    } finally {
      window.clearTimeout(timeout);
      historyBusy = false;
      earlier.disabled = false;
    }
  }

  retry.addEventListener('click', function () { loadFact(selectedDate); });
  select.addEventListener('change', function () { navigate(select.value); });
  earlier.addEventListener('click', function () { if (nextBefore || historyFailed) loadHistory(); });
  window.addEventListener('popstate', function () { loadFact(new URL(window.location.href).searchParams.get('date') || ''); });
  copy.addEventListener('click', async function () {
    if (!currentFact || activeRequest) return;
    copy.disabled = true;
    var copySequence = sequence;
    try {
      await navigator.clipboard.writeText(currentFact.title + '\n\n' + currentFact.fact + '\n\n' + currentFact.explanation);
      if (copySequence !== sequence) return;
      copyStatus.textContent = 'Copied to clipboard.';
    } catch (error) {
      if (copySequence !== sequence) return;
      copyStatus.textContent = 'Select the fact text to copy it manually.';
    } finally {
      if (!activeRequest) copy.disabled = !currentFact;
    }
  });

  document.getElementById('fact-browser').hidden = false;
  loadFact(new URL(window.location.href).searchParams.get('date') || '');
  loadHistory();
})();
