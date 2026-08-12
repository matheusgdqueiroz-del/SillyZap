/* =====================================================================
   SillyZap — a WhatsApp Web-style skin for SillyTavern
   ---------------------------------------------------------------------
   Behaviour layer. Builds the messenger chrome (icon rail, chat list,
   conversation header, composer icons) and post-processes SillyTavern's
   chat into bubbles with timestamps, read receipts, date separators,
   sender grouping and group-chat sender names.

   Everything is scoped behind the `wa-skin` class on <body>, and every
   node this file creates is tracked so the skin can be torn down cleanly
   when it is disabled.

   https://github.com/matheusgdqueiroz-del/SillyZap
   ===================================================================== */
'use strict';

/** Key used for this extension's slice of SillyTavern's settings. */
const EXT_ID = 'SillyZap';

/* =====================================================================
   UI STRINGS
   All user-facing text lives here — translating the skin means editing
   this one object. Dates and times are localised automatically through
   Intl and follow SillyTavern's UI language.
   ===================================================================== */
const TXT = {
    // rail
    railChats: 'Chats',
    railStatus: 'Status',
    railChannels: 'Channels',
    railCommunities: 'Communities',
    railSettings: 'Settings (opens the SillyTavern panel)',
    railProfile: 'Profile',

    // sidebar
    newChat: 'New chat',
    menu: 'Menu',
    searchPlaceholder: 'Search or start a new chat',
    filterAll: 'All',
    filterUnread: 'Unread',
    filterFavourites: 'Favourites',
    filterGroups: 'Groups',
    archived: 'Archived',
    promo: 'Download the desktop app',
    emptyPreview: 'Tap to start chatting',
    mediaPreview: 'Media',
    youPrefix: 'You: ',

    // conversation header
    videoCall: 'Video call',
    search: 'Search',
    statusOnline: 'online',
    statusTyping: 'typing…',

    // composer
    emoji: 'Emoji',
    voiceMessage: 'Voice message',
    typeMessage: 'Type a message',

    // chat body
    encryption: 'Messages are end-to-end encrypted. No one outside of this chat can read them.',

    // contact editor
    editContact: 'Edit contact',
    newContact: 'New contact',
    choosePhoto: 'Choose photo',
    defaultPhoto: 'Default photo',
    characterImage: 'Character image',
    photoHint: 'Click to choose an image',
    fieldName: 'Name',
    fieldPreview: 'Last message',
    fieldTime: 'Time',
    timePlaceholder: 'e.g. 10:06 or Yesterday',
    isGroup: 'This is a group',
    activeNote: 'The last message and time for this chat update automatically from the conversation.',
    save: 'Save',
    cancel: 'Cancel',
    remove: 'Remove',
    unnamedContact: 'Contact',

    // settings panel
    settingsTitle: 'SillyZap — WhatsApp Web Skin',
    optEnabled: 'Enable the skin',
    optSidebar: 'Show the chat list sidebar',
    optDecoys: 'Show sample contacts in the list',
    optEncryption: 'Show the end-to-end encryption notice',
    optReceipts: 'Show read receipts (blue ticks)',
    optStatus: 'Contact status line',
    optAppTitle: 'Sidebar title',
    resetContacts: 'Restore sample contacts',
    hintContact: 'Contact name and photo for the open chat: click the pencil on its row, or the avatar in the conversation header. Each character keeps its own.',
    hintDecoys: 'Sample contacts are decorative. Hover a row and click the pencil to edit its name, message and photo — the pencil at the top of the list adds a new one.',
    hintPanels: 'SillyTavern\'s own menus are hidden while the skin is on. Bring them back with the ⋮ button in the conversation header or the gear in the rail; press Esc to hide them again.',

    // fallbacks if Intl cannot produce them
    today: 'Today',
    yesterday: 'Yesterday',
};

/* =====================================================================
   SMALL HELPERS
   ===================================================================== */
function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style') node.setAttribute('style', v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const getCtx = () => (globalThis.SillyTavern && globalThis.SillyTavern.getContext) ? globalThis.SillyTavern.getContext() : null;

/** Read double-tick used inside bubbles, and a smaller one for list previews. */
const TICK_SVG = '<svg viewBox="0 0 16 11" width="16" height="11" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6.1 3.35 8.6 8.1 2.5"/><path d="M5.4 8.05 6.2 8.85 11.05 2.5"/></svg>';
const MINI_TICK_SVG = '<svg viewBox="0 0 16 11" width="15" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6.1 3.35 8.6 8.1 2.5"/><path d="M5.4 8.05 6.2 8.85 11.05 2.5"/></svg>';

/** Default grey person silhouette, matching the messenger's placeholder. */
const PERSON_SVG = '<svg viewBox="0 0 212 212" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><rect width="212" height="212" fill="#dfe5e7"/><g fill="#ffffff"><circle cx="106" cy="86" r="36"/><path d="M106 132c-32 0-58 20-63 47a106 106 0 0 0 126 0c-5-27-31-47-63-47z"/></g></svg>';

/* Deterministic colour for initial-avatars and group sender names. */
const AV_COLORS = ['#0a7cff', '#e542a3', '#f5b800', '#00a884', '#9d4edd', '#ff7043', '#26a69a', '#5c6bc0', '#ec407a', '#66bb6a'];
function avatarColor(name) {
    let h = 0;
    const s = String(name || '?');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AV_COLORS[h % AV_COLORS.length];
}
function initials(name) {
    const parts = String(name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '#';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* =====================================================================
   LOCALE-AWARE DATES AND TIMES
   Follows SillyTavern's UI language when available, otherwise the
   browser's. Falls back to a plain 24h clock if Intl refuses the tag.
   ===================================================================== */
function uiLocale() {
    const c = getCtx();
    try {
        const l = c && typeof c.getCurrentLocale === 'function' ? c.getCurrentLocale() : null;
        if (l && typeof l === 'string') return l;
    } catch (e) { /* fall through */ }
    return (typeof navigator !== 'undefined' && navigator.language) || 'en';
}

/** Build an Intl formatter, degrading through locale fallbacks. */
function makeFormatter(build) {
    for (const loc of [uiLocale(), 'en']) {
        try { return build(loc); } catch (e) { /* try the next one */ }
    }
    return null;
}

let timeFmt = null, weekdayFmt = null, dateFmt = null, relFmt = null, fmtLocale = null;
function ensureFormatters() {
    const loc = uiLocale();
    if (fmtLocale === loc && timeFmt) return;
    fmtLocale = loc;
    timeFmt = makeFormatter(l => new Intl.DateTimeFormat(l, { hour: '2-digit', minute: '2-digit' }));
    weekdayFmt = makeFormatter(l => new Intl.DateTimeFormat(l, { weekday: 'long' }));
    dateFmt = makeFormatter(l => new Intl.DateTimeFormat(l, { day: '2-digit', month: '2-digit', year: 'numeric' }));
    relFmt = makeFormatter(l => new Intl.RelativeTimeFormat(l, { numeric: 'auto' }));
}

const pad2 = (n) => String(n).padStart(2, '0');
const capitalise = (s) => (s ? s.charAt(0).toLocaleUpperCase(fmtLocale || 'en') + s.slice(1) : s);

function momentFor(msg) {
    const c = getCtx();
    try {
        if (msg && msg.send_date && c && c.timestampToMoment) {
            const m = c.timestampToMoment(msg.send_date);
            if (m && m.isValid && m.isValid()) return m;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function fmtTime(m) {
    const d = m ? m.toDate() : new Date();
    ensureFormatters();
    if (timeFmt) return timeFmt.format(d);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function dateKey(m) {
    const d = m ? m.toDate() : new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function relativeDay(offset, fallback) {
    ensureFormatters();
    if (relFmt) {
        const s = relFmt.format(offset, 'day');
        // Numeric output ("in 0 days") means this locale has no word for it.
        if (s && !/\d/.test(s)) return capitalise(s);
    }
    return fallback;
}

function dateLabel(m) {
    const d = m ? m.toDate() : new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
    ensureFormatters();
    if (diffDays <= 0) return relativeDay(0, TXT.today);
    if (diffDays === 1) return relativeDay(-1, TXT.yesterday);
    if (diffDays < 7 && weekdayFmt) return capitalise(weekdayFmt.format(d));
    if (dateFmt) return dateFmt.format(d);
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}

/**
 * Bubbles reserve space on their last line for the floated timestamp.
 * 12-hour locales render "10:06 AM", which needs noticeably more room than
 * "10:06", so measure once and hand the widths to the stylesheet.
 */
function applyMetaWidths() {
    const wide = /\p{L}/u.test(fmtTime(null));
    // Set on <body>, not <html>: style.css declares defaults on `body.wa-skin`,
    // and an inherited value from :root would lose to them.
    document.body.style.setProperty('--wa-meta-w', wide ? '80px' : '58px');
    document.body.style.setProperty('--wa-meta-w-out', wide ? '98px' : '76px');
}

/* =====================================================================
   AVATARS
   ===================================================================== */
function makeAvatarInner(contact) {
    // contact: { name, avatar|photo, group, color, defaultPic }
    const src = contact.photo || contact.avatar;
    if (src) {
        const img = el('img', { src, alt: '' });
        img.addEventListener('error', () => { img.replaceWith(makeFallback(contact)); });
        return img;
    }
    return makeFallback(contact);
}

function makeFallback(contact) {
    if (contact.defaultPic) {
        return el('div', { class: 'wa-av-fallback wa-av-default', html: PERSON_SVG });
    }
    if (contact.group) {
        return el('div', { class: 'wa-av-fallback wa-av-group', html: '<i class="fa-solid fa-user-group"></i>' });
    }
    const col = contact.color || avatarColor(contact.name);
    return el('div', { class: 'wa-av-fallback', style: `background:${col}`, text: initials(contact.name) });
}

/** Read a chosen image file, centre-crop and downscale so settings stay small. */
function fileToDataURL(file, size = 120) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = size; canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const s = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } catch (e) { reject(e); }
            };
            img.onerror = reject;
            img.src = fr.result;
        };
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
}

/* =====================================================================
   SETTINGS (persisted in SillyTavern's extensionSettings)
   ===================================================================== */
const DEFAULTS = {
    enabled: true,
    showSidebar: true,
    showDecoys: true,
    showEncryption: true,
    showReceipts: true,
    statusText: TXT.statusOnline,
    appTitle: 'WhatsApp',
};

function settings() {
    const c = getCtx();
    if (!c || !c.extensionSettings) return { ...DEFAULTS };
    c.extensionSettings[EXT_ID] = c.extensionSettings[EXT_ID] || {};
    const s = c.extensionSettings[EXT_ID];
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) s[k] = v;
    }
    return s;
}
function saveSettings() { const c = getCtx(); if (c && c.saveSettingsDebounced) c.saveSettingsDebounced(); }
function skinOn() { return !!settings().enabled; }

/* =====================================================================
   CONTACTS
   ===================================================================== */
/** Stable per-character/group key for name and photo overrides. */
function currentCharKey() {
    const c = getCtx();
    if (!c) return null;
    if (c.groupId) return 'group:' + c.groupId;
    const ch = c.characters && c.characters[c.characterId];
    return ch ? ('char:' + ch.avatar) : null;
}
function charOverrides() {
    const s = settings();
    if (!s.charOverrides || typeof s.charOverrides !== 'object') s.charOverrides = {};
    return s.charOverrides;
}

/** The contact shown in the conversation header — the open character or group. */
function currentContact() {
    const c = getCtx();
    let base = { name: settings().appTitle || 'Chat', avatar: null, group: false };
    if (c) {
        if (c.groupId) {
            const g = (c.groups || []).find(x => x.id === c.groupId);
            base = { name: g ? g.name : 'Group', avatar: null, group: true };
        } else if (c.characters && c.characters[c.characterId]) {
            const ch = c.characters[c.characterId];
            let av = null;
            try { av = c.getThumbnailUrl ? c.getThumbnailUrl('avatar', ch.avatar) : null; } catch (e) { av = null; }
            base = { name: ch.name, avatar: av, group: false };
        }
    }
    const key = currentCharKey();
    const ov = key ? charOverrides()[key] : null;
    if (ov) {
        if (ov.name && ov.name.trim()) base.name = ov.name.trim();
        if (ov.photo === 'default') { base.avatar = null; base.photo = null; base.defaultPic = true; }
        else if (ov.photo) { base.photo = ov.photo; }
    }
    return base;
}

/** The rail's bottom avatar is "you" — SillyTavern's active persona. */
function currentPersona() {
    const c = getCtx();
    const name = (c && c.name1) || 'You';
    const pick = (sel) => {
        const img = document.querySelector(sel);
        const src = img && img.getAttribute('src');
        return src || null;
    };
    const photo = pick('#user_avatar_block .avatar-container.selected .avatar img')
        || pick('#user_avatar_block .avatar-container.selected img')
        || pick('#chat .mes[is_user="true"] .mesAvatarWrapper .avatar img');
    return { name, photo, defaultPic: !photo && !name };
}

/* Sample contacts: decorative rows that make the list look inhabited.
   Deliberately generic — edit or delete them from the list's pencil. */
const SAMPLE_CONTACTS = [
    { name: 'Alex Carter', preview: 'Sounds good, see you at eight', time: '10:06', color: '#e542a3' },
    { name: 'Weekend trip', preview: '~Sam: tickets are booked!', time: '10:05', badge: 12, group: true },
    { name: 'Jordan Reyes', preview: 'Photo', time: '09:48', color: '#5c6bc0' },
    { name: 'Book club', preview: '~Riley: chapter four broke me', time: '09:41', group: true },
    { name: 'Work', preview: 'report-final-v3.pdf • 2 pages', time: '09:35', badge: 3, color: '#26a69a' },
    { name: 'Morgan Lee', preview: 'Ok', time: '09:35', color: '#ff7043' },
    { name: 'Family', preview: 'Mum: call me when you can', time: '09:31', group: true },
    { name: 'Casey', preview: 'haha no way', time: '@yesterday', color: '#9d4edd' },
    { name: 'Taylor Brooks', preview: '@you sent the files over', time: '@yesterday', color: '#00a884' },
];

let contactSeq = 0;
function newContactId() { return 'c' + Date.now().toString(36) + (contactSeq++).toString(36); }

/** Expand the @yesterday / @you tokens in the samples using the current language. */
function seedContacts() {
    const yesterday = relativeDay(-1, TXT.yesterday);
    return SAMPLE_CONTACTS.map(d => Object.assign({ id: newContactId() }, d, {
        time: d.time === '@yesterday' ? yesterday : d.time,
        preview: String(d.preview).replace('@you', TXT.youPrefix),
    }));
}

/** The editable contact list, persisted in extensionSettings. */
function getContacts() {
    const s = settings();
    if (!Array.isArray(s.contacts)) { s.contacts = seedContacts(); saveSettings(); }
    s.contacts.forEach(c => { if (!c.id) c.id = newContactId(); });
    return s.contacts;
}

function lastMessagePreview() {
    const c = getCtx();
    if (!c || !Array.isArray(c.chat) || !c.chat.length) return { text: TXT.emptyPreview, time: '', fromUser: false };
    const last = c.chat[c.chat.length - 1];
    let txt = String(last.mes || '');
    txt = txt.replace(/<[^>]*>/g, ' ');     // strip HTML
    txt = txt.replace(/[*_`~#>]/g, '');     // strip markdown markers
    txt = txt.replace(/\s+/g, ' ').trim();
    return { text: txt || TXT.mediaPreview, time: fmtTime(momentFor(last)), fromUser: !!last.is_user };
}

/* =====================================================================
   BUILD: far-left icon rail
   ===================================================================== */
function buildRail() {
    if (document.getElementById('wa-rail')) return;
    const railBtn = (icon, opts = {}) => {
        const b = el('div', { class: 'wa-rail-btn' + (opts.active ? ' active' : ''), title: opts.title || '' },
            [el('i', { class: icon })]);
        // The badge is always created and hidden when empty, so turning sample
        // contacts back on can reveal it without rebuilding the rail.
        if (opts.badge !== undefined) b.appendChild(el('div', { class: 'wa-rail-badge' }));
        if (opts.onclick) b.addEventListener('click', opts.onclick);
        return b;
    };
    const top = el('div', { class: 'wa-rail-top' }, [
        railBtn('fa-solid fa-message', { active: true, title: TXT.railChats, badge: true }),
        railBtn('fa-regular fa-circle', { title: TXT.railStatus }),
        railBtn('fa-solid fa-tower-broadcast', { title: TXT.railChannels }),
        railBtn('fa-solid fa-people-group', { title: TXT.railCommunities }),
    ]);
    const bottom = el('div', { class: 'wa-rail-bottom' }, [
        railBtn('fa-solid fa-gear', { title: TXT.railSettings, onclick: toggleSettings }),
        el('div', { class: 'wa-rail-avatar', title: TXT.railProfile, onclick: toggleSettings }),
    ]);
    document.body.appendChild(el('div', { id: 'wa-rail' }, [top, bottom]));
    refreshRailAvatar();
}

function refreshRailAvatar() {
    const wrap = document.querySelector('#wa-rail .wa-rail-avatar');
    if (!wrap) return;
    const persona = currentPersona();
    // Rebuild only on a real change — SETTINGS_UPDATED fires often, and
    // recreating the <img> every time makes the avatar flicker.
    const sig = (persona.photo || '') + '|' + (persona.name || '');
    if (wrap.dataset.waSig === sig) return;
    wrap.dataset.waSig = sig;
    wrap.innerHTML = '';
    wrap.appendChild(makeAvatarInner(persona));
}

/** Unread counts shown on the rail badge and the filter chips. */
function unreadTotal() {
    if (!settings().showDecoys) return 0;
    return getContacts().reduce((n, c) => n + (Number(c.badge) || 0), 0);
}
function unreadChats() {
    if (!settings().showDecoys) return 0;
    return getContacts().filter(c => Number(c.badge) > 0).length;
}
function groupCount() {
    if (!settings().showDecoys) return 0;
    return getContacts().filter(c => c.group).length;
}

/* =====================================================================
   BUILD: sidebar (chat list)
   ===================================================================== */
function buildSidebar() {
    if (document.getElementById('wa-sidebar')) return;
    const s = settings();

    const header = el('div', { class: 'wa-sb-header' }, [
        el('div', { class: 'wa-sb-title', id: 'wa-sb-title', text: s.appTitle || '' }),
        el('div', { class: 'wa-sb-actions' }, [
            el('div', { class: 'wa-icon-btn', title: TXT.newChat, html: '<i class="fa-solid fa-pen-to-square"></i>', onclick: () => openContactEditor(null, { add: true }) }),
            el('div', { class: 'wa-icon-btn', title: TXT.menu, html: '<i class="fa-solid fa-ellipsis-vertical"></i>', onclick: toggleSettings }),
        ]),
    ]);

    const search = el('div', { class: 'wa-search-wrap' }, [
        el('div', { class: 'wa-search' }, [
            el('i', { class: 'fa-solid fa-magnifying-glass' }),
            el('input', { type: 'text', placeholder: TXT.searchPlaceholder, id: 'wa-search-input' }),
        ]),
    ]);

    const filters = el('div', { class: 'wa-filters', id: 'wa-filters' });

    const list = el('div', { class: 'wa-list', id: 'wa-list' });

    const promo = el('div', { class: 'wa-promo' }, [
        el('div', { class: 'wa-promo-logo', html: '<i class="fa-brands fa-whatsapp"></i>' }),
        el('div', { text: TXT.promo }),
    ]);

    document.body.appendChild(el('div', { id: 'wa-sidebar' }, [header, search, filters, list, promo]));
    bindSearch();
    renderFilters();
    renderList();
}

/** The search box filters the visible rows — it is not decorative. */
function bindSearch() {
    const input = document.getElementById('wa-search-input');
    if (!input) return;
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        document.querySelectorAll('#wa-list .wa-row').forEach(row => {
            const name = (row.querySelector('.wa-name')?.textContent || '').toLowerCase();
            const prev = (row.querySelector('.wa-preview')?.textContent || '').toLowerCase();
            row.classList.toggle('wa-hidden', !!q && !name.includes(q) && !prev.includes(q));
        });
        const arch = document.querySelector('#wa-list .wa-archived');
        if (arch) arch.classList.toggle('wa-hidden', !!q);
    });
}

function renderFilters() {
    const wrap = document.getElementById('wa-filters');
    if (!wrap) return;
    wrap.innerHTML = '';
    const chip = (label, count, active) => {
        const c = el('div', { class: 'wa-chip' + (active ? ' active' : '') }, [document.createTextNode(label)]);
        if (count) c.appendChild(el('span', { class: 'wa-chip-count', text: ' ' + count }));
        return c;
    };
    wrap.appendChild(chip(TXT.filterAll, null, true));
    wrap.appendChild(chip(TXT.filterUnread, unreadChats()));
    wrap.appendChild(chip(TXT.filterFavourites, null));
    wrap.appendChild(chip(TXT.filterGroups, groupCount()));
}

function makeRow(contact, opts = {}) {
    const avatar = el('div', { class: 'wa-avatar' }, [makeAvatarInner(contact)]);
    const previewChildren = [];
    if (opts.previewTick) previewChildren.push(el('span', { class: 'wa-mini-tick', html: MINI_TICK_SVG }));
    previewChildren.push(el('span', { text: contact.preview || '' }));

    const rowTopRight = [el('span', { class: 'wa-time', text: contact.time || '' })];
    const rowBotRight = [];
    if (contact.badge) rowBotRight.push(el('div', { class: 'wa-badge', text: String(contact.badge) }));

    const body = el('div', { class: 'wa-rowbody' }, [
        el('div', { class: 'wa-row-top' }, [
            el('div', { class: 'wa-name', text: contact.name }),
            ...rowTopRight,
        ]),
        el('div', { class: 'wa-row-bot' }, [
            el('div', { class: 'wa-preview' }, previewChildren),
            ...rowBotRight,
        ]),
    ]);
    const row = el('div', { class: 'wa-row' + (opts.active ? ' active' : '') + (contact.badge ? ' unread' : '') }, [avatar, body]);
    if (typeof opts.onEdit === 'function') {
        row.addEventListener('click', opts.onEdit);
        const pencil = el('div', { class: 'wa-row-edit', title: TXT.editContact, html: '<i class="fa-solid fa-pen"></i>' });
        pencil.addEventListener('click', (e) => { e.stopPropagation(); opts.onEdit(); });
        row.appendChild(pencil);
    }
    return row;
}

function renderList() {
    const list = document.getElementById('wa-list');
    if (!list) return;
    const s = settings();
    list.innerHTML = '';

    list.appendChild(el('div', { class: 'wa-archived' }, [
        el('i', { class: 'fa-solid fa-box-archive' }),
        el('span', { class: 'wa-arch-label', text: TXT.archived }),
    ]));

    // The active row is the real SillyTavern character or group, with a live preview.
    const contact = currentContact();
    const lp = lastMessagePreview();
    const activeRow = makeRow(
        { name: contact.name, avatar: contact.avatar, photo: contact.photo, defaultPic: contact.defaultPic, group: contact.group, preview: lp.text, time: lp.time },
        { active: true, previewTick: lp.fromUser, onEdit: () => openContactEditor(null, { active: true }) },
    );
    activeRow.dataset.waActive = '1';

    if (!s.showDecoys) {
        list.appendChild(activeRow);
        return;
    }

    // Sample rows sit around the active one so the list looks lived-in.
    const contacts = getContacts();
    const decoyRow = (d) => list.appendChild(makeRow(d, { onEdit: () => openContactEditor(d.id) }));
    contacts.slice(0, 2).forEach(decoyRow);
    list.appendChild(activeRow);
    contacts.slice(2).forEach(decoyRow);
}

/** Refresh the active row's preview and time without rebuilding the list. */
function updateActivePreview() {
    const row = document.querySelector('#wa-list .wa-row[data-wa-active="1"]');
    if (!row) return;
    const lp = lastMessagePreview();
    const prevEl = row.querySelector('.wa-preview');
    const timeEl = row.querySelector('.wa-time');
    if (prevEl) {
        prevEl.innerHTML = '';
        if (lp.fromUser) prevEl.appendChild(el('span', { class: 'wa-mini-tick', html: MINI_TICK_SVG }));
        prevEl.appendChild(el('span', { text: lp.text }));
    }
    if (timeEl && lp.time) timeEl.textContent = lp.time;
}

/* =====================================================================
   CONTACT EDITOR (name / last message / photo)
   ===================================================================== */
function closeContactEditor() {
    const o = document.getElementById('wa-modal-overlay');
    if (o) o.remove();
}

function openContactEditor(id, opts = {}) {
    closeContactEditor();
    const isActive = !!opts.active, isAdd = !!opts.add;
    const cc = currentContact();

    let src = null;
    let name = '', preview = '', time = '', group = false;
    let photoData = null, useDefault = false;

    if (isActive) {
        const ovKey = currentCharKey();
        const ov = ovKey ? charOverrides()[ovKey] : null;
        name = cc.name;                     // effective name, override already applied
        group = cc.group;
        const ph = ov ? ov.photo : '';
        if (ph === 'default') useDefault = true;
        else if (ph) photoData = ph;
    } else if (isAdd) {
        useDefault = true;
    } else {
        src = getContacts().find(c => c.id === id);
        if (!src) return;
        name = src.name || ''; preview = src.preview || ''; time = src.time || ''; group = !!src.group;
        photoData = src.photo || null; useDefault = !!src.defaultPic;
    }

    const field = (label, input) => el('div', { class: 'wa-modal-field' }, [el('label', { text: label }), input]);

    // ---- photo controls ----
    const photoEl = el('div', { class: 'wa-modal-photo', title: TXT.photoHint });
    const camOverlay = el('div', { class: 'wa-photo-cam', html: '<i class="fa-solid fa-camera"></i>' });
    const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    const renderPhoto = () => {
        photoEl.innerHTML = '';
        photoEl.appendChild(makeAvatarInner({
            name, group, photo: photoData, defaultPic: useDefault,
            avatar: (!photoData && !useDefault && isActive) ? cc.avatar : null,
        }));
        photoEl.appendChild(camOverlay);
    };
    photoEl.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        try { photoData = await fileToDataURL(f); useDefault = false; renderPhoto(); }
        catch (e) { console.error('[SillyZap] image read failed', e); }
    });
    const btnChoose = el('button', { class: 'wa-btn ghost', type: 'button', text: TXT.choosePhoto });
    btnChoose.addEventListener('click', () => fileInput.click());
    const btnDefault = el('button', { class: 'wa-btn ghost', type: 'button', text: TXT.defaultPhoto });
    btnDefault.addEventListener('click', () => { photoData = null; useDefault = true; renderPhoto(); });
    const photoActions = el('div', { class: 'wa-photo-actions' }, [btnChoose, btnDefault]);
    if (isActive) {
        const btnChar = el('button', { class: 'wa-btn ghost', type: 'button', text: TXT.characterImage });
        btnChar.addEventListener('click', () => { photoData = null; useDefault = false; renderPhoto(); });
        photoActions.appendChild(btnChar);
    }

    // ---- text fields ----
    const nameInput = el('input', { type: 'text', value: name, placeholder: TXT.fieldName });
    const fields = [field(TXT.fieldName, nameInput)];
    let prevInput = null, timeInput = null, groupInput = null;
    if (!isActive) {
        prevInput = el('input', { type: 'text', value: preview, placeholder: TXT.fieldPreview });
        timeInput = el('input', { type: 'text', value: time, placeholder: TXT.timePlaceholder });
        groupInput = el('input', { type: 'checkbox' });
        groupInput.checked = group;
        groupInput.addEventListener('change', () => { group = groupInput.checked; renderPhoto(); });
        fields.push(field(TXT.fieldPreview, prevInput));
        fields.push(field(TXT.fieldTime, timeInput));
        fields.push(el('label', { class: 'wa-modal-check' }, [groupInput, document.createTextNode(TXT.isGroup)]));
    } else {
        fields.push(el('div', { class: 'wa-modal-note', text: TXT.activeNote }));
    }

    // ---- footer ----
    const btnSave = el('button', { class: 'wa-btn primary', type: 'button', text: TXT.save });
    const btnCancel = el('button', { class: 'wa-btn ghost', type: 'button', text: TXT.cancel });
    btnCancel.addEventListener('click', closeContactEditor);
    const foot = el('div', { class: 'wa-modal-foot' });
    if (!isActive && !isAdd) {
        const btnDel = el('button', { class: 'wa-btn wa-del', type: 'button', text: TXT.remove });
        btnDel.addEventListener('click', () => {
            const arr = getContacts();
            const i = arr.findIndex(c => c.id === id);
            if (i >= 0) arr.splice(i, 1);
            saveSettings(); refreshChrome(); closeContactEditor();
        });
        foot.appendChild(btnDel);
    }
    foot.appendChild(btnCancel);
    foot.appendChild(btnSave);

    const commit = () => {
        if (isActive) {
            const key = currentCharKey();
            if (key) {
                const ov = charOverrides();
                const nm = nameInput.value.trim();
                const ph = photoData ? photoData : (useDefault ? 'default' : '');
                if (!nm && !ph) delete ov[key];     // nothing customised, fall back to the character
                else ov[key] = { name: nm, photo: ph };
            }
            saveSettings(); refreshHeader(); refreshChrome();
        } else {
            const obj = isAdd ? { id: newContactId() } : src;
            obj.name = nameInput.value.trim() || TXT.unnamedContact;
            obj.preview = prevInput.value;
            obj.time = timeInput.value.trim();
            obj.group = !!groupInput.checked;
            if (photoData) { obj.photo = photoData; obj.defaultPic = false; }
            else { delete obj.photo; obj.defaultPic = useDefault; }
            if (isAdd) getContacts().push(obj);
            saveSettings(); refreshChrome();
        }
        closeContactEditor();
    };
    btnSave.addEventListener('click', commit);

    const modal = el('div', { class: 'wa-modal' }, [
        el('div', { class: 'wa-modal-head', text: isAdd ? TXT.newContact : TXT.editContact }),
        el('div', { class: 'wa-modal-body' }, [
            el('div', { class: 'wa-modal-photo-wrap' }, [photoEl, photoActions, fileInput]),
            ...fields,
        ]),
        foot,
    ]);
    // Enter commits from any text field; Escape is handled globally.
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type === 'text') {
            e.preventDefault();
            commit();
        }
    });

    const overlay = el('div', { id: 'wa-modal-overlay', class: 'wa-modal-overlay' }, [modal]);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeContactEditor(); });
    document.body.appendChild(overlay);
    renderPhoto();
    setTimeout(() => nameInput.focus(), 30);
}

/* =====================================================================
   BUILD: conversation header (inside #sheld, above #chat)
   ===================================================================== */
function buildChatHeader() {
    const sheld = document.getElementById('sheld');
    if (!sheld || document.getElementById('wa-chat-header')) return;
    const header = el('div', { id: 'wa-chat-header' }, [
        el('div', { class: 'wa-ch-avatar', id: 'wa-ch-avatar' }),
        el('div', { class: 'wa-ch-meta' }, [
            el('div', { class: 'wa-ch-name', id: 'wa-ch-name', text: '' }),
            el('div', { class: 'wa-ch-status', id: 'wa-ch-status', text: '' }),
        ]),
        el('div', { class: 'wa-ch-actions' }, [
            el('div', { class: 'wa-icon-btn wa-video', title: TXT.videoCall, html: '<i class="fa-solid fa-video"></i><i class="fa-solid fa-chevron-down"></i>' }),
            el('div', { class: 'wa-icon-btn', title: TXT.search, html: '<i class="fa-solid fa-magnifying-glass"></i>' }),
            el('div', { class: 'wa-icon-btn', title: TXT.menu, html: '<i class="fa-solid fa-ellipsis-vertical"></i>', onclick: toggleSettings }),
        ]),
    ]);
    // The avatar and name open the per-character editor; ⋮ reveals SillyTavern.
    header.querySelector('.wa-ch-avatar').addEventListener('click', () => openContactEditor(null, { active: true }));
    header.querySelector('.wa-ch-meta').addEventListener('click', () => openContactEditor(null, { active: true }));
    sheld.insertBefore(header, sheld.firstChild);
    refreshHeader();
}

function refreshHeader() {
    const contact = currentContact();
    const av = document.getElementById('wa-ch-avatar');
    const nm = document.getElementById('wa-ch-name');
    const st = document.getElementById('wa-ch-status');
    if (av) { av.innerHTML = ''; av.appendChild(makeAvatarInner(contact)); }
    if (nm) nm.textContent = contact.name;
    if (st && !document.body.classList.contains('wa-generating')) st.textContent = settings().statusText || TXT.statusOnline;
}

/** Repaint every piece of chrome that depends on the contact list or persona. */
function refreshChrome() {
    const title = document.getElementById('wa-sb-title');
    if (title) title.textContent = settings().appTitle || '';
    renderFilters();
    renderList();
    refreshRailAvatar();
    const badge = document.querySelector('#wa-rail .wa-rail-badge');
    if (badge) {
        const n = unreadTotal();
        badge.textContent = String(n);
        badge.classList.toggle('wa-hidden', n <= 0);
    }
}

let typingTimer = null;
function setTyping(on) {
    clearTimeout(typingTimer);
    document.body.classList.toggle('wa-generating', !!on);
    const st = document.getElementById('wa-ch-status');
    if (st) st.textContent = on ? TXT.statusTyping : (settings().statusText || TXT.statusOnline);
    // Safety net: never leave "typing…" or the stop button stuck if an end event is missed.
    if (on) typingTimer = setTimeout(() => setTyping(false), 120000);
}

/* =====================================================================
   BUILD: composer icons
   The "+" attach and sticker icons are swapped in CSS (see style.css) so
   they survive SillyTavern re-rendering those buttons.
   ===================================================================== */
let placeholderObserver = null;
let originalPlaceholders = null;

function buildComposer() {
    const left = document.getElementById('leftSendForm');
    const right = document.getElementById('rightSendForm');
    const ta = document.getElementById('send_textarea');

    if (left && !left.querySelector('.wa-emoji')) {
        const emoji = el('div', { class: 'wa-compose-ico wa-emoji', title: TXT.emoji, html: '<i class="fa-regular fa-face-smile"></i>' });
        emoji.addEventListener('click', () => ta && ta.focus());
        left.insertBefore(emoji, left.firstChild);
    }
    if (right && !right.querySelector('.wa-mic')) {
        right.appendChild(el('div', { class: 'wa-compose-ico wa-mic', title: TXT.voiceMessage, html: '<i class="fa-solid fa-microphone"></i>' }));
    }
    if (ta) {
        if (!originalPlaceholders) {
            originalPlaceholders = {
                placeholder: ta.getAttribute('placeholder'),
                no_connection_text: ta.getAttribute('no_connection_text'),
                connected_text: ta.getAttribute('connected_text'),
            };
        }
        // Read "Type a message" regardless of API connection state.
        ta.setAttribute('no_connection_text', TXT.typeMessage);
        ta.setAttribute('connected_text', TXT.typeMessage);
        ta.setAttribute('placeholder', TXT.typeMessage);
        if (!placeholderObserver) {
            placeholderObserver = new MutationObserver(() => {
                if (ta.getAttribute('placeholder') !== TXT.typeMessage) {
                    ta.setAttribute('placeholder', TXT.typeMessage);
                }
            });
            placeholderObserver.observe(ta, { attributes: true, attributeFilter: ['placeholder'] });
        }
    }
    if (ta && !ta.dataset.waBound) {
        ta.dataset.waBound = '1';
        const sync = () => {
            const form = document.getElementById('form_sheld');
            if (form) form.classList.toggle('wa-has-text', ta.value.trim().length > 0);
        };
        ta.addEventListener('input', sync);
        ta.addEventListener('change', sync);
        sync();
    }
}

function teardownComposer() {
    document.querySelectorAll('#leftSendForm .wa-compose-ico, #rightSendForm .wa-compose-ico').forEach(n => n.remove());
    if (placeholderObserver) { placeholderObserver.disconnect(); placeholderObserver = null; }
    const ta = document.getElementById('send_textarea');
    if (ta && originalPlaceholders) {
        for (const [k, v] of Object.entries(originalPlaceholders)) {
            if (v === null || v === undefined) ta.removeAttribute(k);
            else ta.setAttribute(k, v);
        }
    }
    const form = document.getElementById('form_sheld');
    if (form) form.classList.remove('wa-has-text');
}

/* =====================================================================
   PROCESS CHAT: bubbles, timestamps, ticks, grouping, separators
   ===================================================================== */
function clearInjected(root) {
    (root || document).querySelectorAll('.wa-date-sep, .wa-encryption').forEach(n => n.remove());
}

function ensureMeta(mes, timeText, isUser) {
    const block = mes.querySelector('.mes_block');
    if (!block) return;
    let meta = block.querySelector(':scope > .wa-meta');
    if (!meta) {
        meta = el('div', { class: 'wa-meta' }, [el('span', { class: 'wa-time' })]);
        block.appendChild(meta);
    }
    let timeEl = meta.querySelector('.wa-time');
    if (!timeEl) { timeEl = el('span', { class: 'wa-time' }); meta.appendChild(timeEl); }
    if (timeEl.textContent !== timeText) timeEl.textContent = timeText;

    let ticks = meta.querySelector('.wa-ticks');
    if (isUser) {
        if (!ticks) meta.appendChild(el('span', { class: 'wa-ticks', html: TICK_SVG }));
    } else if (ticks) {
        ticks.remove();
    }
}

/** In group chats the messenger labels each incoming bubble with its sender. */
function ensureSender(mes, name, show) {
    const block = mes.querySelector('.mes_block');
    if (!block) return;
    let sender = block.querySelector(':scope > .wa-sender');
    if (!show || !name) { if (sender) sender.remove(); return; }
    if (!sender) {
        sender = el('div', { class: 'wa-sender' });
        block.insertBefore(sender, block.firstChild);
    }
    if (sender.textContent !== name) sender.textContent = name;
    const col = avatarColor(name);
    if (sender.style.color !== col) sender.style.color = col;
}

const NEAR_BOTTOM_PX = 140;
function isNearBottom(node) {
    return (node.scrollHeight - node.scrollTop - node.clientHeight) < NEAR_BOTTOM_PX;
}

const processChat = debounce(function () {
    const chat = document.getElementById('chat');
    if (!chat || !skinOn()) return;
    const c = getCtx();
    const s = settings();

    // Only follow new content if the reader was already at the bottom, so
    // scrolling back through history (or loading older messages) stays put.
    const stick = isNearBottom(chat);

    clearInjected(chat);

    const messages = Array.from(chat.querySelectorAll(':scope > .mes'));
    const isGroupChat = !!(c && c.groupId);
    let prevUser = null;
    let prevSender = null;
    let prevDateKey = null;

    if (messages.length && s.showEncryption) {
        chat.insertBefore(el('div', { class: 'wa-encryption' }, [
            el('span', {}, [
                el('i', { class: 'fa-solid fa-lock' }),
                document.createTextNode(TXT.encryption),
            ]),
        ]), messages[0]);
    }

    messages.forEach(mes => {
        const id = parseInt(mes.getAttribute('mesid'), 10);
        const isUser = mes.getAttribute('is_user') === 'true';
        const msg = (c && Array.isArray(c.chat) && !isNaN(id)) ? c.chat[id] : null;
        const m = momentFor(msg);
        const dk = dateKey(m);
        const senderName = (msg && msg.name) || mes.getAttribute('ch_name') || '';

        if (dk !== prevDateKey) {
            chat.insertBefore(el('div', { class: 'wa-date-sep' }, [el('span', { text: dateLabel(m) })]), mes);
            prevDateKey = dk;
            prevUser = null;        // the first bubble after a separator always starts a group
            prevSender = null;
        }

        // A new group starts when the side changes, or (in group chats) the speaker does.
        const groupStart = (isUser !== prevUser) || (isGroupChat && !isUser && senderName !== prevSender);
        mes.classList.toggle('wa-group-start', groupStart);
        prevUser = isUser;
        prevSender = isUser ? null : senderName;

        ensureMeta(mes, fmtTime(m), isUser);
        ensureSender(mes, senderName, isGroupChat && !isUser && groupStart);
    });

    updateActivePreview();

    if (stick) {
        try { chat.scrollTop = chat.scrollHeight; } catch (e) { /* ignore */ }
    }
}, 40);

/* =====================================================================
   REVEALING SILLYTAVERN'S OWN UI
   ===================================================================== */
function toggleSettings() {
    document.body.classList.toggle('wa-show-settings');
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('wa-modal-overlay')) { closeContactEditor(); return; }
    if (document.body.classList.contains('wa-show-settings')) {
        document.body.classList.remove('wa-show-settings');
    }
});

/* =====================================================================
   SETTINGS PANEL (Extensions tab)
   ===================================================================== */
function labeledCheckbox(label, checked, onChange) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { class: 'checkbox_label wa-opt' }, [input, document.createTextNode(label)]);
}

function labeledText(label, value, onChange) {
    const input = el('input', { type: 'text', class: 'text_pole', value: value || '' });
    input.addEventListener('input', debounce(() => onChange(input.value), 250));
    return el('div', { class: 'wa-opt-text' }, [el('small', { text: label }), input]);
}

function hint(text) {
    return el('small', { class: 'wa-hint', text });
}

function buildSettingsPanel() {
    const host = document.getElementById('extensions_settings') || document.getElementById('extensions_settings2');
    if (!host || document.getElementById('wa-settings-block')) return;
    const s = settings();

    const resetBtn = el('div', { class: 'menu_button wa-reset-btn', text: TXT.resetContacts });
    resetBtn.addEventListener('click', () => {
        settings().contacts = seedContacts();
        saveSettings();
        refreshChrome();
    });

    host.appendChild(el('div', { id: 'wa-settings-block', class: 'inline-drawer' }, [
        el('div', { class: 'inline-drawer-toggle inline-drawer-header' }, [
            el('b', { text: TXT.settingsTitle }),
            el('div', { class: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' }),
        ]),
        el('div', { class: 'inline-drawer-content' }, [
            labeledCheckbox(TXT.optEnabled, s.enabled, (v) => { settings().enabled = v; saveSettings(); applyEnabled(); }),
            labeledCheckbox(TXT.optSidebar, s.showSidebar, (v) => { settings().showSidebar = v; saveSettings(); applySidebarVisibility(); }),
            labeledCheckbox(TXT.optDecoys, s.showDecoys, (v) => { settings().showDecoys = v; saveSettings(); refreshChrome(); }),
            labeledCheckbox(TXT.optEncryption, s.showEncryption, (v) => { settings().showEncryption = v; saveSettings(); processChat(); }),
            labeledCheckbox(TXT.optReceipts, s.showReceipts, (v) => { settings().showReceipts = v; saveSettings(); applyToggleClasses(); }),
            labeledText(TXT.optStatus, s.statusText, (v) => { settings().statusText = v; saveSettings(); refreshHeader(); }),
            labeledText(TXT.optAppTitle, s.appTitle, (v) => { settings().appTitle = v; saveSettings(); refreshChrome(); }),
            hint(TXT.hintContact),
            hint(TXT.hintDecoys),
            resetBtn,
            hint(TXT.hintPanels),
        ]),
    ]));
}

/* =====================================================================
   ENABLE / DISABLE
   ===================================================================== */
function applyToggleClasses() {
    const s = settings();
    document.body.classList.toggle('wa-no-receipts', !s.showReceipts);
}

function applySidebarVisibility() {
    document.body.classList.toggle('wa-no-sidebar', !settings().showSidebar);
}

function applyEnabled() {
    if (!settings().enabled) { destroySkin(); return; }

    document.body.classList.add('wa-skin');
    applyMetaWidths();
    applyToggleClasses();
    applySidebarVisibility();
    buildRail();
    buildSidebar();
    buildChatHeader();
    buildComposer();
    refreshHeader();
    refreshChrome();
    processChat();
}

function destroySkin() {
    document.body.classList.remove('wa-skin', 'wa-show-settings', 'wa-generating', 'wa-no-sidebar', 'wa-no-receipts');
    closeContactEditor();
    ['wa-rail', 'wa-sidebar', 'wa-chat-header'].forEach(id => document.getElementById(id)?.remove());
    clearInjected(document);
    document.querySelectorAll('.wa-meta, .wa-sender').forEach(n => n.remove());
    document.querySelectorAll('.wa-group-start').forEach(n => n.classList.remove('wa-group-start'));
    teardownComposer();
    document.body.style.removeProperty('--wa-meta-w');
    document.body.style.removeProperty('--wa-meta-w-out');
    clearTimeout(typingTimer);
}

/* =====================================================================
   INIT
   ===================================================================== */
let chatObserver = null;

function bindEvents() {
    const c = getCtx();
    if (!c || !c.eventSource || !c.eventTypes) return;
    const E = c.eventTypes;
    const on = (evt, fn) => { if (evt) c.eventSource.on(evt, () => { if (skinOn()) fn(); }); };

    on(E.CHAT_CHANGED, () => { refreshHeader(); refreshChrome(); setTyping(false); processChat(); });
    on(E.USER_MESSAGE_RENDERED, () => processChat());
    on(E.CHARACTER_MESSAGE_RENDERED, () => { setTyping(false); processChat(); });
    on(E.MESSAGE_SWIPED, () => processChat());
    on(E.MESSAGE_DELETED, () => processChat());
    on(E.MESSAGE_EDITED, () => processChat());
    on(E.MESSAGE_UPDATED, () => processChat());
    on(E.MORE_MESSAGES_LOADED, () => processChat());
    on(E.GENERATION_STARTED, () => setTyping(true));
    on(E.GENERATION_ENDED, () => setTyping(false));
    on(E.GENERATION_STOPPED, () => setTyping(false));
    on(E.SETTINGS_UPDATED, () => refreshRailAvatar());

    // Catch renders that do not raise an event (checkpoints, branch loads, …).
    const chat = document.getElementById('chat');
    if (chat && !chatObserver) {
        chatObserver = new MutationObserver((muts) => {
            if (!skinOn()) return;
            for (const mu of muts) {
                for (const list of [mu.addedNodes, mu.removedNodes]) {
                    for (const n of list) {
                        if (n.nodeType === 1 && n.classList && n.classList.contains('mes')) { processChat(); return; }
                    }
                }
            }
        });
        chatObserver.observe(chat, { childList: true });
    }
}

function init() {
    try {
        applyEnabled();
        buildSettingsPanel();
        bindEvents();
        // The extensions panel can be built after us; retry once.
        setTimeout(buildSettingsPanel, 1500);
        // …and the first chat can render late.
        setTimeout(() => { if (skinOn()) processChat(); }, 600);
        console.log('[SillyZap] skin initialised');
    } catch (e) {
        console.error('[SillyZap] init error', e);
    }
}

(function boot() {
    const start = () => {
        const c = getCtx();
        if (!c || !c.eventSource || !c.eventTypes) return false;
        // APP_READY may already have fired, so initialise now and again on the event.
        init();
        try {
            c.eventSource.on(c.eventTypes.APP_READY, () => { applyEnabled(); processChat(); });
        } catch (e) { /* ignore */ }
        return true;
    };
    if (!start()) {
        const iv = setInterval(() => { if (start()) clearInterval(iv); }, 120);
        setTimeout(() => clearInterval(iv), 20000);
    }
})();
