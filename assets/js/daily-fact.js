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
  var busy = false;
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
    if (typeof data.fact_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.fact_date)) return false;
    var date = new Date(data.fact_date + 'T00:00:00Z');
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === data.fact_date;
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

  async function loadFact() {
    if (busy) return;
    busy = true;
    retry.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    showState('Finding a little wonder', 'Loading the daily fact…', false);
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch(panel.dataset.endpoint, {
        method: 'GET', mode: 'cors', credentials: 'omit', signal: controller.signal
      });
      if (response.status === 503) {
        showState('A little wonder is on its way', 'The daily fact hasn’t been published yet. Check back soon.', true);
        return;
      }
      if (!response.ok) throw new Error('Fact request failed');
      var data = await response.json();
      if (!validFact(data)) throw new Error('Invalid fact response');
      render(data);
    } catch (error) {
      var timedOut = error.name === 'AbortError';
      showState(timedOut ? 'That took a little too long' : 'We couldn’t load the fact',
        timedOut ? 'The connection timed out. Please try again.' : 'Please check your connection and try again.', true);
    } finally {
      window.clearTimeout(timeout);
      busy = false;
      retry.disabled = false;
      panel.setAttribute('aria-busy', 'false');
    }
  }

  retry.addEventListener('click', loadFact);
  copy.addEventListener('click', async function () {
    if (!currentFact) return;
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(currentFact.title + '\n\n' + currentFact.fact + '\n\n' + currentFact.explanation);
      document.getElementById('fact-copy-status').textContent = 'Copied to your clipboard.';
    } catch (error) {
      document.getElementById('fact-copy-status').textContent = 'Couldn’t copy. Select the fact text to copy it manually.';
    } finally {
      copy.disabled = false;
    }
  });
  loadFact();
})();
