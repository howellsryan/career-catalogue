(function () {
  "use strict";

  var THEME_LABEL = {
    ease: "Getting started",
    work: "How the work moved",
    felt: "How it felt",
    craft: "Quality",
    value: "Value",
    together: "Working together",
    learn: "What we learned",
    next: "The next fortnight",
    shape: "A shape for the hour"
  };

  var DEPTH_LABEL = { 1: "Ease in", 2: "The work", 3: "Deeper" };

  var QUESTIONS = [
    { id: "q01", theme: "ease", warmth: 1, text: "What's one small thing from the last fortnight that made the work feel lighter?", facilitate: "Take the first answer, even if it is ordinary. Small is the point — it lets quieter people in before you ask anything heavier.", follow: "What would make more of the fortnight feel like that?" },
    { id: "q02", theme: "ease", warmth: 1, text: "If this fortnight had a weather report, what was it — and did it match the forecast we set?", facilitate: "Let people be playful. The metaphor is a way to talk about pace and surprise without starting on blame.", follow: "What should next fortnight's forecast actually say?" },
    { id: "q03", theme: "ease", warmth: 1, text: "Who quietly unblocked someone else, and what did that look like?", facilitate: "Name the act, not a personality award. Specific is kinder than 'shout out to the team'.", follow: "How do we make that kind of help visible without turning it into theatre?" },
    { id: "q04", theme: "ease", warmth: 1, text: "What did you notice about how we started the days versus how we finished them?", facilitate: "This stays observational. You are collecting a pattern, not a verdict.", follow: "Is that a calendar problem, an energy problem, or a work-in-progress problem?" },
    { id: "q05", theme: "ease", warmth: 1, text: "Name a decision we made that you still agree with.", facilitate: "Starting with something that held is a better warm-up than starting with what broke. People will get to the hard part.", follow: "What made that decision easy to keep?" },
    { id: "q06", theme: "ease", warmth: 1, text: "What's a shortcut, habit or tool you picked up that the rest of us should steal?", facilitate: "Give it twenty seconds of silence. The useful answers are rarely the first tool someone remembers.", follow: "Who will actually show that to the group, rather than us all nodding?" },
    { id: "q07", theme: "ease", warmth: 1, text: "If a new joiner had shadowed us for a day, what would have surprised them — in a good way?", facilitate: "Good-way is deliberate. You can ask for the other surprise later, once people are talking.", follow: "Is that surprise something we should write down, or does it only work because it isn't a rule?" },
    { id: "q08", theme: "ease", warmth: 1, text: "What conversation did we almost have, and then didn't?", facilitate: "Don't interrogate the first person who answers. Thank them and ask if anyone else nearly had the same one.", follow: "Do we have it now, in this room, or does it need a smaller room?" },
    { id: "q09", theme: "work", warmth: 2, text: "Where did work sit still, and whose attention would have moved it?", facilitate: "Keep it on the work, not on a person's character. 'Whose attention' includes people outside the team.", follow: "What will we do in the first two days of next fortnight so that piece doesn't sit still again?" },
    { id: "q10", theme: "work", warmth: 2, text: "Which piece of work was smaller than we feared, and which was larger?", facilitate: "You are calibrating the team's sense of size, not re-litigating an estimate in public.", follow: "What did the larger one have in it that we couldn't see from the ticket?" },
    { id: "q11", theme: "work", warmth: 2, text: "When did we start something before we understood it?", facilitate: "Say this lightly. Most teams do it. The useful part is what 'understood' would have looked like.", follow: "What is the smallest question we should have answered first?" },
    { id: "q12", theme: "work", warmth: 2, text: "What did we finish that we would not start again, knowing what we know now?", facilitate: "This is about learning, not about regretting out loud until someone feels foolish.", follow: "How do we tell the next team, or our future selves, without a long write-up nobody will read?" },
    { id: "q13", theme: "work", warmth: 2, text: "Where did 'almost done' hide the real remaining work?", facilitate: "Ask for one example. Almost-done is usually review, release, or a conversation nobody booked.", follow: "What should 'done' have included that it didn't?" },
    { id: "q14", theme: "work", warmth: 2, text: "If we could only protect one working agreement next fortnight, which one earned it?", facilitate: "If the team has no written agreements, ask which unspoken one they kept anyway. That is the draft of the real one.", follow: "Who will notice if we drop it?" },
    { id: "q15", theme: "work", warmth: 2, text: "What did we sound certain about in planning that the work then contradicted?", facilitate: "Certainty is the subject, not who was wrong. Write the contradicted assumption in a sentence.", follow: "Where are we being certain again, right now, on the next board?" },
    { id: "q16", theme: "felt", warmth: 2, text: "When did the work feel like yours, and when did it feel like it was happening to you?", facilitate: "Let people answer for themselves. Don't correct their experience into a process point too quickly.", follow: "What was different about the piece that felt like yours?" },
    { id: "q17", theme: "felt", warmth: 3, text: "Was there a moment you wanted to say something and chose not to? What would have made it easier?", facilitate: "You do not need them to reveal the thing. The second half of the question is the one you can act on. Offer your own small example first if the room goes quiet.", follow: "Is that a change for this meeting, or for how we disagree in the week?" },
    { id: "q18", theme: "felt", warmth: 3, text: "Where did you spend energy on looking busy rather than making progress?", facilitate: "This only works if you are willing to answer it too. Go first, briefly, then stop.", follow: "What in the system rewarded the appearance?" },
    { id: "q19", theme: "felt", warmth: 3, text: "What are you carrying into the next fortnight that is not written on the board?", facilitate: "People may name worry, a stakeholder, or a half-done thing. All of those count. Don't force it onto a ticket unless they want that.", follow: "Does anyone else need to carry it with you?" },
    { id: "q20", theme: "felt", warmth: 2, text: "Who did you rely on, and did they know?", facilitate: "Reliance that was invisible is the interesting half. Keep it specific to the fortnight.", follow: "How do we ask for that earlier, without a meeting about asking?" },
    { id: "q21", theme: "felt", warmth: 3, text: "When did you feel like a player in the work, and when did you feel like a pawn?", facilitate: "If the word 'pawn' makes someone flinch, that is information. Stay with the example, not the label.", follow: "Which decisions next fortnight should sit with the people doing the work?" },
    { id: "q22", theme: "craft", warmth: 2, text: "What did we ship that we would still put our names on in six months?", facilitate: "Pride is allowed. You are trying to see what 'good' means here, not to collect compliments.", follow: "What did that piece have that the rushed one didn't?" },
    { id: "q23", theme: "craft", warmth: 2, text: "Where did we trade a future problem for a present convenience?", facilitate: "No need to undo it in the retro. Name the trade so it was a choice, not an accident we pretend didn't happen.", follow: "Do we owe that future problem a date, or was the trade worth keeping?" },
    { id: "q24", theme: "craft", warmth: 2, text: "Which bug, incident or piece of rework was a symptom rather than the cause?", facilitate: "Stop at one. A retro that relitigates an incident timeline is a different meeting.", follow: "What would we change in how we work, not only in the code?" },
    { id: "q25", theme: "craft", warmth: 2, text: "What did review catch that the author already knew?", facilitate: "This is about the review, not about catching someone out. Often the author was waiting for permission.", follow: "What would have helped them say it before the review?" },
    { id: "q26", theme: "value", warmth: 2, text: "What did a real person feel differently because of us this fortnight?", facilitate: "If nobody can name a person, that is the conversation. Don't fill the silence with a feature list.", follow: "How close are we to the next person who should feel a difference?" },
    { id: "q27", theme: "value", warmth: 2, text: "Which item on the board was busy, and which one was valuable?", facilitate: "Busy and valuable can be the same item. Ask them to separate the two anyway.", follow: "What busy work should we stop defending?" },
    { id: "q28", theme: "value", warmth: 2, text: "If we deleted one in-flight piece of work tomorrow, which deletion would we not regret?", facilitate: "You are not committing to delete it in the room. You are finding out what people are carrying out of politeness.", follow: "Who needs to hear that, outside this retro?" },
    { id: "q29", theme: "value", warmth: 2, text: "What did we demonstrate that a stakeholder could actually react to?", facilitate: "Ties the fortnight to the feedback loop. A slide is not a demonstration unless someone could disagree with it.", follow: "What will they be able to react to at the end of the next one?" },
    { id: "q30", theme: "together", warmth: 2, text: "Where did we hand work over, when we should have sat with it together?", facilitate: "Handover isn't always wrong. Ask what got lost in this one.", follow: "What would 'sitting with it' have cost, and was that cost real?" },
    { id: "q31", theme: "together", warmth: 2, text: "Which dependency surprised us, and what would have made it unsurprising?", facilitate: "Surprise is the data. The fix is usually a conversation that should have happened in week one.", follow: "Who do we need to talk to before the next planning, not after the next blockage?" },
    { id: "q32", theme: "together", warmth: 3, text: "When did we ask for help too late?", facilitate: "Answer it yourself if you were the late one. Managers who only ask this of the team teach the wrong lesson.", follow: "What does asking early look like in this team, concretely, on a Tuesday?" },
    { id: "q33", theme: "together", warmth: 2, text: "Where did two people solve the same problem without knowing it?", facilitate: "Keep the tone curious. Duplication is usually a visibility problem.", follow: "Where would that have been visible if we had looked?" },
    { id: "q34", theme: "learn", warmth: 2, text: "What do we know now that we did not know a fortnight ago — and who else needs to know it?", facilitate: "Write the new fact in one sentence. Then decide the audience. Most retros stop before the second half.", follow: "Will we tell them, or will we assume the ticket is enough?" },
    { id: "q35", theme: "learn", warmth: 2, text: "What assumption did the work disprove?", facilitate: "An assumption we no longer believe is more useful than a vague lesson learned.", follow: "Where is that assumption still written down as if it were true?" },
    { id: "q36", theme: "learn", warmth: 2, text: "Where are we one person away from being stuck?", facilitate: "This is the bus-factor question without the morbid metaphor. Look at reviews, releases, and the system nobody else will touch.", follow: "What is the smallest pairing or note that would make it two people?" },
    { id: "q37", theme: "learn", warmth: 2, text: "What did a mistake teach us that a success would have hidden?", facilitate: "Don't hunt for a mistake if the fortnight was calm. You can also ask what a success is hiding.", follow: "How do we keep the lesson without keeping the scar?" },
    { id: "q38", theme: "next", warmth: 2, text: "What should we deliberately not do next fortnight, even if someone asks?", facilitate: "Write the 'not' on the board. A retro that only adds work has not protected the team.", follow: "Who is allowed to say no when the ask arrives?" },
    { id: "q39", theme: "next", warmth: 2, text: "What would a calmer fortnight actually change in the calendar?", facilitate: "Push past 'fewer meetings' until there is a named meeting or a named hour.", follow: "Are we willing to cancel that, or only to wish it?" },
    { id: "q40", theme: "next", warmth: 3, text: "If we only improved one thing before the next retro, what would make this conversation different?", facilitate: "One thing. If the room offers five, ask which one they would notice in two weeks.", follow: "How will we know we did it, without a new dashboard?" },
    { id: "q41", theme: "next", warmth: 2, text: "What are we pretending is fine that we should put on the board?", facilitate: "Pretending is a soft word on purpose. People can answer it without accusing anyone.", follow: "Does it belong on the board, or in a smaller conversation first?" },
    { id: "q42", theme: "next", warmth: 3, text: "What do you need from the rest of us in the first three days, not by the end of the fortnight?", facilitate: "The time box stops this becoming a wish list. Capture asks as names, not as 'the team should'.", follow: "Can that person say yes or no before we leave the room?" }
  ];

  var FORMATS = [
    {
      id: "f01",
      kind: "format",
      title: "Start, stop, continue",
      text: "Three columns. One example each before anyone is allowed a second.",
      beats: [
        { name: "Start", prompt: "Something we are not doing that would have helped this fortnight." },
        { name: "Stop", prompt: "Something we did that cost more than it returned." },
        { name: "Continue", prompt: "Something quiet that worked, and will disappear if we don't name it." }
      ],
      facilitate: "The trap is a pile of Starts and no Stops. If Stop stays empty, ask what you will take off the board to pay for the Starts."
    },
    {
      id: "f02",
      kind: "format",
      title: "Four Ls",
      text: "A little more feeling than start/stop, without asking anyone to perform.",
      beats: [
        { name: "Liked", prompt: "What you would keep, even if nobody else noticed it." },
        { name: "Learned", prompt: "A fact you didn't have two weeks ago." },
        { name: "Lacked", prompt: "What was missing: time, a decision, a person, a tool, courage." },
        { name: "Longed for", prompt: "What you want the next fortnight to feel like, said plainly." }
      ],
      facilitate: "Do Liked and Learned out loud first. Lacked and Longed for can be written, then read, if the room is shy."
    },
    {
      id: "f03",
      kind: "format",
      title: "Sailboat",
      text: "Useful when the fortnight felt like weather rather than a list of tickets.",
      beats: [
        { name: "Island", prompt: "What we are actually sailing towards. One sentence." },
        { name: "Wind", prompt: "What moved us, including things outside the team." },
        { name: "Anchor", prompt: "What slowed us, that we dragged with us." },
        { name: "Rocks", prompt: "What we nearly hit, or did hit, that we should mark on the chart." }
      ],
      facilitate: "If Island is fuzzy, stay there. A retro about anchors is wasted when the team doesn't share a destination."
    },
    {
      id: "f04",
      kind: "format",
      title: "Mad, sad, glad",
      text: "A feelings pass. Short on purpose. Don't turn every card into an action.",
      beats: [
        { name: "Glad", prompt: "Start here. What are you pleased happened." },
        { name: "Sad", prompt: "What disappointed you, without needing a villain." },
        { name: "Mad", prompt: "What frustrated you. Friction is allowed to be said once, cleanly." }
      ],
      facilitate: "Glad first, or Mad swallows the hour. After the pass, choose one Sad or Mad that is worth an action. Leave the rest heard."
    },
    {
      id: "f05",
      kind: "format",
      title: "Energy and drain",
      text: "For a fortnight that looked productive and felt expensive.",
      beats: [
        { name: "Gave energy", prompt: "Work, people or moments that left you more able, not less." },
        { name: "Drained it", prompt: "What cost more attention than the outcome deserved." },
        { name: "Protect", prompt: "One energy-giving thing to put in next fortnight's calendar on purpose." },
        { name: "Reduce", prompt: "One drain to make smaller, not a promise to delete the whole job." }
      ],
      facilitate: "Listen for drains that are meetings, unclear asks, or waiting. Those are yours to change. Don't ask the team to be more resilient about them."
    },
    {
      id: "f06",
      kind: "format",
      title: "One thing we keep talking about",
      text: "Use this to close, after the room has already warmed up. Not as the opening.",
      beats: [
        { name: "Write", prompt: "Each person writes one sentence: the thing we will still be tripping over if we ignore it." },
        { name: "Read", prompt: "Read them without debate. Cluster the ones that are the same thing in different clothes." },
        { name: "Choose", prompt: "Dot-vote a single cluster. Everything else is explicitly parked." },
        { name: "Owner", prompt: "Name who will do the next visible step, and by which day. Not a working group." }
      ],
      facilitate: "If you leave with five themes you have left with none. One owner and one date is the close."
    }
  ];

  var ONES = [
    { id: "o01", theme: "ease", text: "What has your week actually been like, before we talk about the work?", why: "You are checking whether this is a work conversation or a human one. Don't rush the answer into a ticket.", follow: "What would be useful to spend this time on, given that?" },
    { id: "o02", theme: "ease", text: "What's something outside work that is taking more space than usual?", why: "You don't need the details. You need to know if their attention is already spoken for, so you don't misread it as disengagement.", follow: "Is there anything at work we should make lighter while that's true?" },
    { id: "o03", theme: "ease", text: "What are you pleased about that nobody has mentioned?", why: "A lot of good work is invisible because it prevented a problem. This is how you find it.", follow: "Who else should hear that?" },
    { id: "o04", theme: "ease", text: "Where have I been in your way in the last two weeks?", why: "Ask it like you can bear the answer. If you defend yourself, you will not be told again.", follow: "What should I do differently in the next fortnight, specifically?" },
    { id: "o05", theme: "work", text: "Which piece of your work are you least sure about?", why: "Uncertainty shared early is cheaper than confidence performed until review.", follow: "What would make you sure enough to continue — a decision, a pairing, or a smaller slice?" },
    { id: "o06", theme: "work", text: "Where are you waiting, and who are you waiting on?", why: "Waiting hides inside 'still working on it'. Name the wait.", follow: "Do you want me to unblock that, or would that make it worse?" },
    { id: "o07", theme: "work", text: "What are you doing that someone else should own, or that nobody should own?", why: "Good people accumulate work that isn't theirs because they can. That is how they burn out politely.", follow: "What happens if we put it down for a fortnight?" },
    { id: "o08", theme: "work", text: "If you looked at your week as a stranger, what would you say it was optimising for?", why: "The answer is often reviews, meetings, or unblocking others. Check it matches what you think their job is.", follow: "What would you like it to optimise for in the next two weeks?" },
    { id: "o09", theme: "work", text: "What decision are you holding that you could make, or that I should make?", why: "Ambiguous decision rights feel like personal hesitation. Separate the two.", follow: "Let's decide that one before we finish, even if the decision is 'not yet, and here's why'." },
    { id: "o10", theme: "growth", text: "What do you want to be better at in three months, that the current work might not teach you?", why: "Growth that only happens if the roadmap cooperates will not happen. You may have to change the work.", follow: "What is the smallest piece of real work that would practise it?" },
    { id: "o11", theme: "growth", text: "Whose job in this team, or near it, are you curious about?", why: "Curiosity is a better signal than a promotion speech. It tells you where to let them see more.", follow: "Would you like to sit in on that, or try a slice of it?" },
    { id: "o12", theme: "growth", text: "What feedback have you been given that you are still deciding whether to believe?", why: "People often carry a comment for months. You can help them sort signal from noise — including your own past comments.", follow: "Do you want my view on it, or do you want to think out loud?" },
    { id: "o13", theme: "growth", text: "When you imagine the next role, what part of this one do you want to keep?", why: "Stops the conversation becoming an escape fantasy. Continuity matters as much as the climb.", follow: "What part are you ready to give away?" },
    { id: "o14", theme: "growth", text: "What are you avoiding because you might not be good at it yet?", why: "This is the growth edge. Say that 'not good yet' is the condition for learning, not a verdict.", follow: "How public does the first attempt need to be?" },
    { id: "o15", theme: "feedback", text: "What's one thing I should keep doing as your manager, and one thing I should change?", why: "Both halves. Praise-only answers are often politeness. Wait for the change.", follow: "Can you tell me what 'change' would look like in a meeting this week?" },
    { id: "o16", theme: "feedback", text: "Where have I given you feedback that wasn't clear enough to use?", why: "Unclear feedback feels like a mood. You are asking them to send it back.", follow: "Let me try that one again, in a sentence you could act on." },
    { id: "o17", theme: "feedback", text: "Is there feedback you're sitting on for someone else?", why: "A one-to-one is often where unsaid peer feedback surfaces. Help them decide if, and how, to say it. Don't carry it for them unless there's a safety issue.", follow: "Do you want to rehearse the sentence?" },
    { id: "o18", theme: "feedback", text: "What did you do this fortnight that you want a straight reaction to?", why: "Invite them to choose the work. Then be specific: situation, what they did, what it caused. Not 'good job'.", follow: "What part of that do you want to do more deliberately?" },
    { id: "o19", theme: "feedback", text: "When did we disagree, and how did that feel afterwards?", why: "You are checking whether disagreement is safe with you, not reopening the decision by default.", follow: "What would make the next disagreement cleaner?" },
    { id: "o20", theme: "energy", text: "What part of the work gave you energy, and what part took it?", why: "Track this over fortnights. A person who is only drained is not a performance problem yet — they are a design problem.", follow: "What could we move, even slightly, before the next one-to-one?" },
    { id: "o21", theme: "energy", text: "Are you tired in a way that a weekend will fix, or in a way that it won't?", why: "Ask it calmly. If the answer is the second, don't respond with a productivity tip.", follow: "What do you need from me this week — cover, a smaller load, or just for me to know?" },
    { id: "o22", theme: "energy", text: "When did you last feel proud of the work, not just relieved it was finished?", why: "Relief and pride are different. A run of relief is a warning.", follow: "What kind of work produces the pride?" },
    { id: "o23", theme: "energy", text: "What are you saying yes to that you want to say no to?", why: "Find the yes. Then decide together whether the no is allowed. Sometimes you have to be the one who says it.", follow: "Shall I take that no, or do you want to?" },
    { id: "o24", theme: "new", text: "What feels harder than it should, because nobody has explained the local version?", why: "New people struggle with folklore more than with the job. Ask what they have had to infer.", follow: "Who is the right person to make that explicit, and can we do it this week?" },
    { id: "o25", theme: "new", text: "Who have you not met yet that your work depends on?", why: "Introductions are a management job. Don't leave network-building to charm.", follow: "I'll make that introduction. What do you want them to know about you first?" },
    { id: "o26", theme: "new", text: "What have you noticed about how this team really makes decisions?", why: "A new person's read is often more accurate than the team's self-description. Don't argue them out of it immediately.", follow: "What is one decision you are waiting on, so we can test that read?" },
    { id: "o27", theme: "new", text: "What did you expect this job to be, and where is it different?", why: "Gaps between the offer and the week are where resentment starts. Better to name them in month one.", follow: "Which difference is a problem, and which is just new?" },
    { id: "o28", theme: "ease", text: "What should I know before I form a view of how this fortnight went?", why: "A good last question as well as a first. It stops you managing the story you already walked in with.", follow: "Thank them, and change your view if you need to. Say that you have." }
  ];

  var DIMENSIONS = [
    { id: "clarity", name: "Clarity", prompt: "We know what good looks like for the next fortnight." },
    { id: "flow", name: "Flow", prompt: "Work moves. We are not stuck waiting." },
    { id: "quality", name: "Quality", prompt: "We can change the system without holding our breath." },
    { id: "value", name: "Value", prompt: "We can point at who this helps." },
    { id: "voice", name: "Voice", prompt: "The awkward thing gets said while it is still small." },
    { id: "support", name: "Support", prompt: "Asking for help is normal, and it arrives." },
    { id: "pace", name: "Pace", prompt: "The speed is one we can sustain. Nobody is quietly burning." },
    { id: "craft", name: "Craft", prompt: "We are getting better at the work, not only finishing it." }
  ];

  var LEVELS = [
    { id: "low", label: "Needs a conversation" },
    { id: "mid", label: "Mixed" },
    { id: "high", label: "Healthy" }
  ];

  var TABS = ["retro", "forecast", "health", "one-to-ones", "room"];
  var SAMPLE = [6, 9, 7, 4, 8, 11, 5, 8, 6, 10];
  var TRIALS = 10000;
  var MAX_PERIODS = 400;
  var RING = 2 * Math.PI * 34;

  var currentRetro = null;
  var currentOne = null;
  var roundItems = [];
  var forecastSeed = 123456789;
  var lastForecast = null;
  var votes = emptyVotes();
  var clearArmed = false;

  var timer = {
    running: false,
    duration: 8 * 60 * 1000,
    remaining: 8 * 60 * 1000,
    endAt: 0,
    mins: 8
  };

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "\u0026amp;")
      .replace(/</g, "\u0026lt;")
      .replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;")
      .replace(/'/g, "\u0026#39;");
  }

  function storageGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function loadRecent() {
    var raw = storageGet("cc-practice-retro-recent");
    return Array.isArray(raw) ? raw : [];
  }

  function remember(id) {
    var next = [id].concat(loadRecent().filter(function (x) { return x !== id; })).slice(0, 20);
    storageSet("cc-practice-retro-recent", next);
  }

  function pickFrom(pool, avoid) {
    var recent = loadRecent();
    var banned = (avoid || []).concat(recent);
    var choices = pool.filter(function (item) { return banned.indexOf(item.id) === -1; });
    if (!choices.length) {
      choices = pool.filter(function (item) { return (avoid || []).indexOf(item.id) === -1; });
    }
    if (!choices.length) choices = pool.slice();
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function activeTab() {
    var found = "retro";
    TABS.forEach(function (name) {
      if ($("tab-" + name).getAttribute("aria-selected") === "true") found = name;
    });
    return found;
  }

  function selectTab(id) {
    TABS.forEach(function (name) {
      var on = name === id;
      var tab = $("tab-" + name);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      $("panel-" + name).hidden = !on;
    });
    var hash = id === "retro" ? "" : "#" + id;
    history.replaceState(null, "", location.pathname + location.search + hash);
  }

  function currentPool() {
    var warmth = document.querySelector('input[name="warmth"]:checked').value;
    var themeBtn = document.querySelector("#panel-retro .px-chip[aria-pressed='true']");
    var theme = themeBtn ? themeBtn.getAttribute("data-theme") : "any";
    if (theme === "shape") return FORMATS.slice();
    return QUESTIONS.filter(function (q) {
      if (warmth !== "any" && String(q.warmth) !== warmth) return false;
      if (theme !== "any" && q.theme !== theme) return false;
      return true;
    });
  }

  function renderRetro(item) {
    currentRetro = item;
    var card = $("retro-card");
    card.classList.remove("is-in");
    void card.offsetWidth;
    card.classList.add("is-in");

    var intro = $("retro-intro");
    var beats = $("retro-beats");
    var follow = $("retro-follow");

    if (item.kind === "format") {
      $("retro-kicker").textContent = "A shape for the hour";
      $("retro-question").textContent = item.title;
      intro.hidden = false;
      intro.textContent = item.text;
      beats.hidden = false;
      beats.innerHTML = item.beats.map(function (beat) {
        return "<li><strong>" + escapeHtml(beat.name) + "</strong><span>" + escapeHtml(beat.prompt) + "</span></li>";
      }).join("");
      follow.hidden = true;
    } else {
      $("retro-kicker").textContent = THEME_LABEL[item.theme] + " · " + DEPTH_LABEL[item.warmth];
      $("retro-question").textContent = item.text;
      intro.hidden = true;
      beats.hidden = true;
      beats.innerHTML = "";
      if (item.follow) {
        follow.hidden = false;
        follow.innerHTML = "<em>Then ask</em> " + escapeHtml(item.follow);
      } else {
        follow.hidden = true;
      }
    }
    $("retro-facilitate").textContent = item.facilitate;
  }

  function retroPlain(item) {
    if (!item) return "";
    if (item.kind === "format") {
      var lines = item.beats.map(function (b) { return b.name + ": " + b.prompt; });
      return item.title + "\n\n" + item.text + "\n\n" + lines.join("\n") + "\n\nFacilitator: " + item.facilitate;
    }
    var text = item.text + "\n\nFacilitator: " + item.facilitate;
    if (item.follow) text += "\nFollow-up: " + item.follow;
    return text;
  }

  function drawRetro() {
    var pool = currentPool();
    if (!pool.length) {
      $("retro-empty").hidden = false;
      return;
    }
    $("retro-empty").hidden = true;
    var item = pickFrom(pool);
    remember(item.id);
    renderRetro(item);
  }

  function itemSummary(item) {
    return item.kind === "format" ? item.title : item.text;
  }

  function suggestRound() {
    var used = [];
    var open = pickFrom(QUESTIONS.filter(function (q) { return q.warmth === 1; }), used);
    used.push(open.id);
    var shape = pickFrom(FORMATS, used);
    used.push(shape.id);
    var deep = pickFrom(QUESTIONS.filter(function (q) { return q.warmth === 3; }), used);
    used.push(deep.id);
    var close = pickFrom(QUESTIONS.filter(function (q) { return q.theme === "next"; }), used);
    roundItems = [
      { mins: 4, role: "Open the room", item: open },
      { mins: 15, role: "Give the hour a shape", item: shape },
      { mins: 8, role: "Go one level down", item: deep },
      { mins: 4, role: "Close on the next fortnight", item: close }
    ];
    roundItems.forEach(function (step) { remember(step.item.id); });
    var list = $("retro-round-list");
    list.innerHTML = roundItems.map(function (step, index) {
      return '<li class="px-round__item"><span class="px-round__time">' + step.mins + " min</span><div><p class=\"px-round__role\">" +
        escapeHtml(step.role) + '</p><p class="px-round__text">' + escapeHtml(itemSummary(step.item)) +
        '</p></div><button type="button" class="px-btn px-btn--small" data-round="' + index + '">Use this</button></li>';
    }).join("");
    $("retro-round").hidden = false;
    renderRetro(open);
    if (!timer.running) setMinutes(4);
  }

  function copyWithButton(text, button) {
    function done() {
      var original = button.getAttribute("data-label") || button.textContent;
      button.setAttribute("data-label", original);
      button.textContent = "Copied";
      button.classList.add("is-copied");
      window.setTimeout(function () {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1600);
    }
    function fallback() {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(area);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  function renderClock(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    $("timer-clock").textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    var elapsed = timer.duration ? 1 - ms / timer.duration : 1;
    $("timer-ring").style.strokeDashoffset = String(RING * Math.min(1, Math.max(0, elapsed)));
  }

  function setMinutes(mins) {
    timer.running = false;
    timer.mins = mins;
    timer.duration = mins * 60 * 1000;
    timer.remaining = timer.duration;
    $("timer-toggle").textContent = "Start";
    $("retro-timer").classList.remove("is-done");
    $("retro-card").classList.remove("is-done");
    $("timer-status").textContent = "Give the question a little silence before you fill it.";
    document.querySelectorAll("#retro-timer [data-mins]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", Number(btn.getAttribute("data-mins")) === mins ? "true" : "false");
    });
    renderClock(timer.duration);
  }

  function tick() {
    if (!timer.running) return;
    var left = timer.endAt - Date.now();
    if (left <= 0) {
      timer.running = false;
      timer.remaining = 0;
      renderClock(0);
      $("timer-toggle").textContent = "Start";
      $("retro-timer").classList.add("is-done");
      $("retro-card").classList.add("is-done");
      $("timer-status").textContent = "That's the time. Ask if anyone has one last thing, then move.";
      return;
    }
    timer.remaining = left;
    renderClock(left);
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parseHistory(text) {
    return String(text).split(/[^0-9.]+/).filter(Boolean).map(function (part) {
      return Math.round(Number(part) * 10) / 10;
    }).filter(function (n) {
      return Number.isFinite(n) && n >= 0 && n <= 1000;
    }).slice(0, 60);
  }

  function periodWord(count, cadence) {
    var name = cadence === 7 ? "week" : cadence === 14 ? "fortnight" : "period";
    return count === 1 ? name : name + "s";
  }

  function percentile(sorted, p) {
    var idx = Math.ceil(p * sorted.length) - 1;
    if (idx < 0) idx = 0;
    if (idx > sorted.length - 1) idx = sorted.length - 1;
    return sorted[idx];
  }

  function localISO(date) {
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + d;
  }

  function doneDate(iso, periods, cadenceDays) {
    var parts = iso.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + periods * cadenceDays - 1);
    return date;
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function showForecastMessage(message) {
    lastForecast = null;
    $("forecast-say").textContent = message;
    $("forecast-pcts").innerHTML = "";
    $("forecast-chart").innerHTML = "";
    $("forecast-note").textContent = "";
  }

  function drawHistogram(durations, p50, p85) {
    var svg = $("forecast-chart");
    var min = durations[0];
    var max = durations[durations.length - 1];
    var span = max - min;
    var buckets = Math.min(24, span + 1);
    if (buckets < 1) buckets = 1;
    var counts = [];
    var i;
    for (i = 0; i < buckets; i++) counts.push(0);
    durations.forEach(function (d) {
      var idx = span === 0 ? 0 : Math.floor(((d - min) / span) * buckets);
      if (idx >= buckets) idx = buckets - 1;
      if (idx < 0) idx = 0;
      counts[idx] += 1;
    });
    var peak = 1;
    counts.forEach(function (c) { if (c > peak) peak = c; });
    var W = 640;
    var H = 220;
    var padL = 8;
    var padR = 8;
    var padT = 14;
    var padB = 32;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var gap = buckets > 16 ? 2 : 4;
    var barW = (innerW - gap * (buckets - 1)) / buckets;
    var markup = "";
    for (i = 0; i < buckets; i++) {
      var h = (counts[i] / peak) * innerH;
      var x = padL + i * (barW + gap);
      var y = padT + innerH - h;
      var lo = span === 0 ? min : min + (i / buckets) * span;
      var hi = span === 0 ? max : min + ((i + 1) / buckets) * span;
      var hot = hi >= p50 && lo <= p85;
      markup += '<rect class="' + (hot ? "bar" : "bar-muted") + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" width="' + Math.max(barW, 0).toFixed(1) + '" height="' + Math.max(h, counts[i] ? 1.5 : 0).toFixed(1) + '" rx="2"></rect>';
    }
    markup += '<line class="axis" x1="' + padL + '" y1="' + (padT + innerH) + '" x2="' + (W - padR) + '" y2="' + (padT + innerH) + '"></line>';
    markup += '<text class="tick" x="' + padL + '" y="' + (H - 10) + '">' + min + "</text>";
    markup += '<text class="tick" x="' + (W / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + Math.round((min + max) / 2) + "</text>";
    markup += '<text class="tick" x="' + (W - padR) + '" y="' + (H - 10) + '" text-anchor="end">' + max + "</text>";
    svg.innerHTML = markup;
  }

  function runForecast() {
    var history = parseHistory($("tp-paste").value);
    var remaining = Math.round(Number($("remaining").value));
    var cadence = Number($("cadence").value);
    var start = $("start-date").value;
    storageSet("cc-practice-forecast", {
      history: history,
      remaining: remaining,
      cadence: String(cadence),
      start: start
    });

    if (!history.length) {
      showForecastMessage("Add at least one period. Include a zero if a fortnight shipped nothing.");
      return;
    }
    if (!history.some(function (n) { return n > 0; })) {
      showForecastMessage("Every period in that history finished nothing, so the work never completes.");
      return;
    }
    if (!Number.isFinite(remaining) || remaining <= 0) {
      showForecastMessage("Say how many items are still to finish.");
      return;
    }

    var rand = mulberry32(forecastSeed);
    var durations = new Array(TRIALS);
    var capped = 0;
    var t;
    for (t = 0; t < TRIALS; t++) {
      var left = remaining;
      var periods = 0;
      while (left > 0 && periods < MAX_PERIODS) {
        left -= history[(rand() * history.length) | 0];
        periods += 1;
      }
      if (left > 0) capped += 1;
      durations[t] = periods;
    }
    durations.sort(function (a, b) { return a - b; });

    var marks = [
      { p: 0.5, k: "50% · a coin flip", plan: false },
      { p: 0.7, k: "70%", plan: false },
      { p: 0.85, k: "85% · plan with this", plan: true },
      { p: 0.95, k: "95% · a promise", plan: false }
    ];
    var dated = /^\d{4}-\d{2}-\d{2}$/.test(start);
    var results = marks.map(function (mark) {
      var periods = percentile(durations, mark.p);
      var when = dated ? formatDate(doneDate(start, periods, cadence)) : null;
      return { p: mark.p, k: mark.k, plan: mark.plan, periods: periods, when: when };
    });
    var plan = results[2];
    var avg = history.reduce(function (sum, n) { return sum + n; }, 0) / history.length;
    var naive = Math.ceil(remaining / avg);

    lastForecast = {
      history: history,
      remaining: remaining,
      cadence: cadence,
      start: dated ? start : null,
      results: results,
      avg: avg,
      naive: naive,
      capped: capped
    };

    var say = plan.when
      ? "Plan on " + plan.when + ". That is " + plan.periods + " " + periodWord(plan.periods, cadence) + " — the date 85% of runs finished by. Half of them finish sooner. Don't promise the half."
      : "Plan on " + plan.periods + " " + periodWord(plan.periods, cadence) + ". That is the 85% outcome. Add a start date if you want it on the calendar.";
    if (results[0].periods === results[3].periods) {
      say += " Even 95% of runs land in that same period. The fortnights you entered look alike, so the range is tight — it will open up as soon as a slow period is in the history.";
    } else if (results[0].periods === plan.periods) {
      say += " The coin-flip and the plan fall in the same period, because the history is steady. The date you would actually promise, at 95%, is " +
        (results[3].when ? results[3].when + ", " : "") + results[3].periods + " " + periodWord(results[3].periods, cadence) + ".";
    }
    $("forecast-say").textContent = say;

    $("forecast-pcts").innerHTML = results.map(function (row) {
      return '<article class="px-pct' + (row.plan ? " px-pct--plan" : "") + '"><span class="px-pct__k">' + escapeHtml(row.k) +
        '</span><span class="px-pct__n">' + (row.when ? escapeHtml(row.when) : row.periods + " " + periodWord(row.periods, cadence)) +
        '</span><span class="px-pct__s">' + row.periods + " " + periodWord(row.periods, cadence) + "</span></article>";
    }).join("");

    drawHistogram(durations, results[0].periods, results[2].periods);

    var note = "Each run samples your history at random, with replacement, until " + remaining +
      " items are finished. Same idea as a throughput Monte Carlo: the future is assumed to look like the fortnights you typed, not like the average of them. Average pace is " +
      avg.toFixed(1) + " a period, and " + remaining + " divided by that is " + naive + " " + periodWord(naive, cadence) +
      ". That single number hides the slow periods. The bars are how often each finish showed up. The stronger colour is the stretch from the coin-flip to the date you plan with.";
    if (history.length < 6) note += " Fewer than six periods is a thin history. Treat the dates as a sketch, and keep collecting.";
    if (capped / TRIALS > 0.02) note += " Some runs still hadn't finished after " + MAX_PERIODS + " periods. If zeros dominate the history, the backlog is not this team's current pace.";
    $("forecast-note").textContent = note;
  }

  function forecastPlain() {
    if (!lastForecast) return "";
    var f = lastForecast;
    var lines = [
      "Throughput forecast — 10,000 Monte Carlo runs",
      "",
      "History: " + f.history.join(", "),
      "Remaining: " + f.remaining,
      "Period length: " + f.cadence + " days",
      f.start ? "Next period starts: " + f.start : "",
      ""
    ];
    f.results.forEach(function (row) {
      lines.push(row.k + ": " + row.periods + " " + periodWord(row.periods, f.cadence) + (row.when ? " (by " + row.when + ")" : ""));
    });
    lines.push("");
    lines.push("Plan in public at 85%. The 50% date is a coin flip — quoting only that is how a range becomes a late project. This assumes the next periods resemble the history above: same team, same kind of work, same definition of done. It is not a commitment.");
    return lines.filter(function (line) { return line !== ""; }).join("\n");
  }

  function emptyVotes() {
    var bag = {};
    DIMENSIONS.forEach(function (dim) {
      bag[dim.id] = { low: 0, mid: 0, high: 0 };
    });
    return bag;
  }

  function voteTotal(bag) {
    return bag.low + bag.mid + bag.high;
  }

  function voteScore(bag) {
    var total = voteTotal(bag);
    if (!total) return null;
    return (bag.low * 1 + bag.mid * 3 + bag.high * 5) / total;
  }

  function scoreWord(score) {
    if (score == null) return "No votes yet";
    if (score >= 4.2) return "Mostly healthy";
    if (score >= 3.2) return "Leaning healthy";
    if (score >= 2.4) return "Mixed";
    return "Needs a conversation";
  }

  function loadVotes() {
    var raw = storageGet("cc-practice-health");
    votes = emptyVotes();
    if (!raw) return;
    DIMENSIONS.forEach(function (dim) {
      var saved = raw[dim.id];
      if (!saved) return;
      LEVELS.forEach(function (level) {
        var n = Math.round(Number(saved[level.id]));
        if (Number.isFinite(n) && n > 0 && n < 500) votes[dim.id][level.id] = n;
      });
    });
  }

  function saveVotes() {
    storageSet("cc-practice-health", votes);
  }

  function buildHealth() {
    $("health-rows").innerHTML = DIMENSIONS.map(function (dim) {
      var controls = LEVELS.map(function (level) {
        return '<div class="px-vote"><span class="px-vote__label">' + escapeHtml(level.label) +
          '</span><button type="button" data-op="minus" data-level="' + level.id + '" aria-label="Remove a ' +
          escapeHtml(level.label) + " vote for " + escapeHtml(dim.name) + '">−</button><span class="px-vote__n" data-level="' +
          level.id + '">0</span><button type="button" data-op="plus" data-level="' + level.id + '" aria-label="Add a ' +
          escapeHtml(level.label) + " vote for " + escapeHtml(dim.name) + '">+</button></div>';
      }).join("");
      return '<article class="px-dim" data-dim="' + dim.id + '"><h3 class="px-dim__name">' + escapeHtml(dim.name) +
        '</h3><p class="px-dim__prompt">' + escapeHtml(dim.prompt) + '</p><div class="px-votes">' + controls + "</div></article>";
    }).join("");
  }

  function paintHealth() {
    DIMENSIONS.forEach(function (dim) {
      var row = document.querySelector('.px-dim[data-dim="' + dim.id + '"]');
      LEVELS.forEach(function (level) {
        row.querySelector('.px-vote__n[data-level="' + level.id + '"]').textContent = String(votes[dim.id][level.id]);
      });
    });
    drawRadar();
    $("health-read").textContent = healthRead();
  }

  function healthRead() {
    var scored = DIMENSIONS.map(function (dim) {
      return { dim: dim, score: voteScore(votes[dim.id]), total: voteTotal(votes[dim.id]) };
    }).filter(function (row) { return row.total > 0; });
    if (!scored.length) return "Add a few votes and the shape appears. Unvoted lines are missing, not a zero.";
    if (scored.length < 3) return scored.length + " of " + DIMENSIONS.length + " have a vote. Keep going — a shape needs at least three.";
    var ordered = scored.slice().sort(function (a, b) { return a.score - b.score; });
    var talk = ordered.filter(function (row) { return row.score < 3.2; }).slice(0, 2);
    var protect = ordered.filter(function (row) { return row.score >= 4.2; }).slice(-2);
    var text = scored.length + " of " + DIMENSIONS.length + " lines have been spoken for.";
    if (talk.length) text += " Talk about " + talk.map(function (row) { return row.dim.name; }).join(" and ") + " first.";
    if (protect.length) text += " Protect " + protect.map(function (row) { return row.dim.name; }).join(" and ") + ".";
    if (!talk.length) text += " Nothing is calling for urgent attention. Ask what people are not saying anyway.";
    if (scored.length < DIMENSIONS.length) text += " Lines with no votes are left off the shape.";
    return text;
  }

  function drawRadar() {
    var svg = $("health-radar");
    var cx = 200;
    var cy = 200;
    var radius = 118;
    var steps = 4;
    var markup = "";
    var s;
    for (s = 1; s <= steps; s++) {
      var pts = DIMENSIONS.map(function (_, i) {
        var ang = -Math.PI / 2 + i * (2 * Math.PI / DIMENSIONS.length);
        var r = (radius * s) / steps;
        return (cx + Math.cos(ang) * r).toFixed(1) + "," + (cy + Math.sin(ang) * r).toFixed(1);
      }).join(" ");
      markup += '<polygon class="grid" points="' + pts + '"></polygon>';
    }
    var shape = [];
    DIMENSIONS.forEach(function (dim, i) {
      var ang = -Math.PI / 2 + i * (2 * Math.PI / DIMENSIONS.length);
      markup += '<line class="axis-line" x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(ang) * radius).toFixed(1) +
        '" y2="' + (cy + Math.sin(ang) * radius).toFixed(1) + '"></line>';
      var score = voteScore(votes[dim.id]);
      var labelR = radius + 22;
      var lx = cx + Math.cos(ang) * labelR;
      var ly = cy + Math.sin(ang) * labelR;
      var anchor = Math.cos(ang) > 0.35 ? "start" : Math.cos(ang) < -0.35 ? "end" : "middle";
      markup += '<text class="label" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor +
        '" dominant-baseline="middle">' + escapeHtml(dim.name) + "</text>";
      if (score != null) {
        var r = ((score - 1) / 4) * radius;
        shape.push((cx + Math.cos(ang) * r).toFixed(1) + "," + (cy + Math.sin(ang) * r).toFixed(1));
      }
    });
    if (shape.length >= 3) markup += '<polygon class="shape" points="' + shape.join(" ") + '"></polygon>';
    svg.innerHTML = markup;
  }

  function healthPlain() {
    var today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    var lines = ["Team health — " + today, ""];
    DIMENSIONS.forEach(function (dim) {
      var bag = votes[dim.id];
      var score = voteScore(bag);
      lines.push(dim.name + " — " + scoreWord(score) + " (" + bag.low + " needs a conversation, " + bag.mid + " mixed, " + bag.high + " healthy)");
    });
    lines.push("");
    lines.push(healthRead());
    lines.push("A conversation, not a score to keep on a person.");
    return lines.join("\n");
  }

  function onePool() {
    var btn = document.querySelector("#one-chips .px-chip[aria-pressed='true']");
    var theme = btn ? btn.getAttribute("data-one") : "any";
    if (theme === "any") return ONES.slice();
    return ONES.filter(function (item) { return item.theme === theme; });
  }

  function renderOne(item) {
    currentOne = item;
    var card = $("one-card");
    card.classList.remove("is-in");
    void card.offsetWidth;
    card.classList.add("is-in");
    var labels = {
      ease: "Ease in",
      work: "The work",
      growth: "Growth",
      feedback: "Feedback",
      energy: "Energy",
      "new": "New to the team"
    };
    $("one-kicker").textContent = labels[item.theme] || "One-to-one";
    $("one-question").textContent = item.text;
    $("one-why").textContent = item.why;
    $("one-follow").innerHTML = "<em>If you need a second</em> " + escapeHtml(item.follow);
  }

  function drawOne() {
    var pool = onePool();
    var item = pickFrom(pool);
    remember(item.id);
    renderOne(item);
  }

  function money(amount, currency) {
    var symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
    return symbol + Math.round(amount).toLocaleString("en-GB");
  }

  function trimNum(n) {
    return (Math.round(n * 10) / 10).toString();
  }

  function runRoom() {
    var people = Number($("meet-people").value);
    var mins = Number($("meet-mins").value);
    var rate = Number($("meet-rate").value);
    var currency = $("meet-currency").value;
    var focusPeople = Number($("focus-people").value);
    var meetings = Number($("focus-meetings").value);
    var available = Number($("focus-available").value);

    storageSet("cc-practice-room", {
      people: people,
      mins: mins,
      rate: rate,
      currency: currency,
      focusPeople: focusPeople,
      meetings: meetings,
      available: available
    });

    if (!(people > 0) || !(mins > 0) || !(rate >= 0)) {
      $("meet-say").textContent = "Add the people, the minutes and a rough hourly cost.";
    } else {
      var hours = mins / 60;
      var cost = people * rate * hours;
      var personHours = people * hours;
      $("meet-say").textContent = "This meeting is about " + money(cost, currency) + " and " +
        trimNum(personHours) + " person-hours. Held every fortnight for a quarter, that is " +
        money(cost * 6, currency) + ". Worth saying the number before the invite goes out.";
    }

    if (!(focusPeople > 0) || !(available > 0) || !(meetings >= 0)) {
      $("focus-say").textContent = "Add the team size and the hours.";
      return;
    }
    var left = Math.max(0, available - meetings);
    var ratio = meetings / available;
    var line = "Each person has " + trimNum(left) + " focus hours left this week. Across " +
      focusPeople + ", that is " + trimNum(left * focusPeople) + " hours to actually move work. Meetings are " +
      Math.round(ratio * 100) + "% of the hours you called available.";
    if (ratio >= 0.5) line += " More than half the week is already spoken for. The board will not move at the speed the calendar implies.";
    else if (ratio >= 0.3) line += " Past about a third, the long block goes. Look for one recurring meeting that could have been a note.";
    else line += " There is still a real stretch of making time. Protect it on purpose, or the next meeting will take it.";
    $("focus-say").textContent = line;
  }

  function loadForecastForm() {
    var saved = storageGet("cc-practice-forecast");
    if (saved && Array.isArray(saved.history) && saved.history.length) {
      $("tp-paste").value = saved.history.join(", ");
      if (saved.remaining) $("remaining").value = saved.remaining;
      if (saved.cadence) $("cadence").value = String(saved.cadence);
      if (saved.start) $("start-date").value = saved.start;
    }
    if (!$("start-date").value) $("start-date").value = localISO(new Date());
  }

  function loadRoom() {
    var saved = storageGet("cc-practice-room");
    if (!saved) return;
    if (saved.people) $("meet-people").value = saved.people;
    if (saved.mins) $("meet-mins").value = saved.mins;
    if (saved.rate != null) $("meet-rate").value = saved.rate;
    if (saved.currency) $("meet-currency").value = saved.currency;
    if (saved.focusPeople) $("focus-people").value = saved.focusPeople;
    if (saved.meetings != null) $("focus-meetings").value = saved.meetings;
    if (saved.available) $("focus-available").value = saved.available;
  }

  function bind() {
    document.querySelector(".px-switch").addEventListener("click", function (event) {
      var tab = event.target.closest(".px-tab");
      if (!tab) return;
      selectTab(tab.id.replace("tab-", ""));
    });

    document.querySelector(".px-switch").addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      var current = activeTab();
      var index = TABS.indexOf(current);
      if (index < 0) return;
      event.preventDefault();
      var next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      $("tab-" + next).focus();
      selectTab(next);
    });

    document.querySelector("#panel-retro .px-chips").addEventListener("click", function (event) {
      var chip = event.target.closest(".px-chip");
      if (!chip) return;
      chip.parentElement.querySelectorAll(".px-chip").forEach(function (other) {
        other.setAttribute("aria-pressed", other === chip ? "true" : "false");
      });
    });

    $("one-chips").addEventListener("click", function (event) {
      var chip = event.target.closest(".px-chip");
      if (!chip) return;
      chip.parentElement.querySelectorAll(".px-chip").forEach(function (other) {
        other.setAttribute("aria-pressed", other === chip ? "true" : "false");
      });
    });

    $("retro-draw").addEventListener("click", drawRetro);
    $("retro-copy").addEventListener("click", function () {
      copyWithButton(retroPlain(currentRetro), $("retro-copy"));
    });
    $("retro-round-btn").addEventListener("click", suggestRound);
    $("retro-round-list").addEventListener("click", function (event) {
      var button = event.target.closest("[data-round]");
      if (!button) return;
      var step = roundItems[Number(button.getAttribute("data-round"))];
      if (!step) return;
      renderRetro(step.item);
      if (!timer.running) setMinutes(step.mins);
    });

    document.querySelectorAll("#retro-timer [data-mins]").forEach(function (button) {
      button.addEventListener("click", function () {
        setMinutes(Number(button.getAttribute("data-mins")));
      });
    });

    $("timer-toggle").addEventListener("click", function () {
      if (timer.running) {
        timer.remaining = Math.max(0, timer.endAt - Date.now());
        timer.running = false;
        $("timer-toggle").textContent = "Resume";
        $("timer-status").textContent = "Paused. The room can finish the sentence.";
        return;
      }
      if (timer.remaining <= 0) setMinutes(timer.mins);
      timer.endAt = Date.now() + timer.remaining;
      timer.running = true;
      $("timer-toggle").textContent = "Pause";
      $("retro-timer").classList.remove("is-done");
      $("retro-card").classList.remove("is-done");
      $("timer-status").textContent = "Running. Let the first answer be incomplete.";
    });

    $("timer-reset").addEventListener("click", function () { setMinutes(timer.mins); });

    document.addEventListener("keydown", function (event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      var target = event.target;
      if (target && (target.matches("input, textarea, select") || target.isContentEditable)) return;
      if (activeTab() !== "retro") return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        drawRetro();
      }
      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        copyWithButton(retroPlain(currentRetro), $("retro-copy"));
      }
    });

    ["tp-paste", "remaining", "cadence", "start-date"].forEach(function (id) {
      $(id).addEventListener("input", runForecast);
      $(id).addEventListener("change", runForecast);
    });

    $("forecast-rerun").addEventListener("click", function () {
      forecastSeed = (forecastSeed + 997) >>> 0;
      runForecast();
    });

    $("forecast-sample").addEventListener("click", function () {
      $("tp-paste").value = SAMPLE.join(", ");
      $("remaining").value = "24";
      runForecast();
    });

    $("forecast-copy").addEventListener("click", function () {
      var text = forecastPlain();
      if (!text) return;
      copyWithButton(text, $("forecast-copy"));
    });

    $("health-rows").addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) return;
      var dim = button.closest(".px-dim").getAttribute("data-dim");
      var level = button.getAttribute("data-level");
      if (button.getAttribute("data-op") === "plus") votes[dim][level] += 1;
      if (button.getAttribute("data-op") === "minus") votes[dim][level] = Math.max(0, votes[dim][level] - 1);
      clearArmed = false;
      $("health-reset").textContent = "Clear votes";
      saveVotes();
      paintHealth();
    });

    $("health-copy").addEventListener("click", function () {
      copyWithButton(healthPlain(), $("health-copy"));
    });

    $("health-reset").addEventListener("click", function () {
      if (!clearArmed) {
        clearArmed = true;
        $("health-reset").textContent = "Clear all votes?";
        window.setTimeout(function () {
          clearArmed = false;
          $("health-reset").textContent = "Clear votes";
        }, 2800);
        return;
      }
      clearArmed = false;
      votes = emptyVotes();
      saveVotes();
      paintHealth();
      $("health-reset").textContent = "Clear votes";
    });

    $("one-draw").addEventListener("click", drawOne);
    $("one-copy").addEventListener("click", function () {
      if (!currentOne) return;
      copyWithButton(currentOne.text + "\n\nWhy this one: " + currentOne.why + "\nIf you need a second: " + currentOne.follow, $("one-copy"));
    });

    ["meet-people", "meet-mins", "meet-rate", "meet-currency", "focus-people", "focus-meetings", "focus-available"].forEach(function (id) {
      $(id).addEventListener("input", runRoom);
      $(id).addEventListener("change", runRoom);
    });

    window.setInterval(tick, 200);
  }

  loadForecastForm();
  loadRoom();
  loadVotes();
  buildHealth();
  paintHealth();
  setMinutes(8);
  drawRetro();
  drawOne();
  runForecast();
  runRoom();
  bind();
})();
