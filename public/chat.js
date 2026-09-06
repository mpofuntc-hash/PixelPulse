// PixelPulse modern chat UI — global threads + DMs with reply support
(function() {
    'use strict';

    // State
    let currentThreadId = null;
    let threadPollInterval = null;
    let currentDMUserId = null;
    let dmPollInterval = null;
    let dmReplyToId = null;

    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escAttr(s) {
        return escHtml(String(s)).replace(/'/g, "\\'");
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(ts) {
        const d = new Date(ts);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // ---------- Tabs ----------
    window.switchChatTab = function(tab) {
        stopChatPolling();
        ['community', 'dms'].forEach(t => {
            const btn = document.getElementById('chatTab-' + t);
            const view = document.getElementById('chat-' + t + '-view');
            if (btn) btn.classList.toggle('active', t === tab);
            if (view) view.style.display = t === tab ? 'grid' : 'none';
        });
        if (tab === 'community') loadCommunityThreads();
        if (tab === 'dms') { loadDMConversations(); loadOnlineUsers(); }
    };

    window.stopChatPolling = function() {
        if (threadPollInterval) { clearInterval(threadPollInterval); threadPollInterval = null; }
        if (dmPollInterval) { clearInterval(dmPollInterval); dmPollInterval = null; }
        currentThreadId = null;
        currentDMUserId = null;
    };

    // ---------- Community Threads ----------
    window.loadCommunityThreads = async function() {
        const list = document.getElementById('communityThreadList');
        if (list) list.innerHTML = '<div style="color:#888;padding:12px;">Loading threads...</div>';
        try {
            const res = await fetch('/api/chat/community');
            const threads = await res.json();
            if (threads.length === 0) {
                if (list) list.innerHTML = '<div style="color:#888;padding:12px;text-align:center;">No threads yet. Start the conversation!</div>';
                return;
            }
            if (!list) return;
            list.innerHTML = threads.map(t => `
                <div class="chat-thread-card" id="thread-card-${t.id}" onclick="openThread(${t.id}, '${escAttr(t.username)}')">
                    <div class="chat-thread-card-title">${escHtml(t.message)}</div>
                    <div class="chat-thread-card-meta">
                        <span style="color:#e50914">${escHtml(t.username)}</span> · ${t.reply_count || 0} repl${t.reply_count === 1 ? 'y' : 'ies'}
                        ${t.last_reply_at ? ' · active ' + formatTime(t.last_reply_at) : ' · ' + formatTime(t.created_at)}
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error('loadCommunityThreads error', e);
        }
    };

    window.openThread = async function(threadId, authorName) {
        currentThreadId = threadId;
        stopThreadPolling();

        const header = document.getElementById('communityThreadHeader');
        const composer = document.getElementById('communityThreadComposer');
        const messagesEl = document.getElementById('communityThreadMessages');

        if (header) header.innerHTML = '<span style="color:#888">Thread by</span> <span style="color:#e50914;font-weight:700">' + escHtml(authorName || 'Unknown') + '</span>';
        if (composer) composer.style.display = 'flex';
        if (messagesEl) messagesEl.innerHTML = '<div style="color:#888;text-align:center;padding-top:40px;">Loading thread...</div>';

        try {
            const res = await fetch('/api/chat/thread/' + threadId);
            const messages = await res.json();
            if (!res.ok) throw new Error(messages.error);
            renderThreadMessages(messages);
            startThreadPolling(threadId);
        } catch (e) {
            if (messagesEl) messagesEl.innerHTML = '<div style="color:#e50914;text-align:center;padding-top:40px;">Failed to load thread</div>';
        }
    };

    function renderThreadMessages(messages) {
        const container = document.getElementById('communityThreadMessages');
        if (!container) return;
        if (!Array.isArray(messages) || messages.length === 0) {
            container.innerHTML = '<div style="color:#888;text-align:center;padding-top:80px;">No messages in this thread yet.</div>';
            return;
        }

        const root = messages[0];
        let html = `
            <div style="background:#161626;border:1px solid #2a2a3e;border-radius:12px;padding:16px;margin-bottom:18px;">
                <div class="chat-message-row">
                    <div class="chat-avatar">${getAvatarHtml ? getAvatarHtml('', 0, 36) : ''}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                            <span style="color:#e50914;font-weight:700;">${escHtml(root.username)}</span>
                            <span style="color:#666;font-size:12px;">${formatDate(root.created_at)} ${formatTime(root.created_at)}</span>
                        </div>
                        <div style="color:#fff;line-height:1.5;word-wrap:break-word;">${escHtml(root.message)}</div>
                    </div>
                </div>
            </div>
            <div style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px 46px;">Replies</div>
        `;

        // Load avatars for all users in thread
        const userIds = [...new Set(messages.map(m => m.user_id))];
        if (getUserAvatar) userIds.forEach(uid => getUserAvatar(uid));

        html += messages.slice(1).map(msg => {
            const isMe = msg.user_id === currentUserId;
            const indent = Math.min((msg.depth || 1) * 18, 54);
            return `
                <div class="chat-message-row ${isMe ? 'self' : ''}" style="margin-left:${indent}px;">
                    <div class="chat-avatar">${getAvatarHtml ? getAvatarHtml('', 0, 32) : ''}</div>
                    <div class="chat-bubble ${isMe ? 'chat-bubble-self' : 'chat-bubble-other'}">
                        <div style="font-size:12px;font-weight:700;color:${isMe ? '#ffcccc' : '#e50914'};margin-bottom:3px;">${escHtml(msg.username)}</div>
                        <div>${escHtml(msg.message)}</div>
                        <div class="chat-meta" style="color:${isMe ? '#ffcccc' : '#888'};text-align:${isMe ? 'left' : 'left'};">${formatTime(msg.created_at)}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    function startThreadPolling(threadId) {
        if (threadPollInterval) clearInterval(threadPollInterval);
        threadPollInterval = setInterval(() => {
            if (currentThreadId === threadId) openThread(threadId);
        }, 4000);
    }

    function stopThreadPolling() {
        if (threadPollInterval) { clearInterval(threadPollInterval); threadPollInterval = null; }
    }

    window.sendThreadReply = async function() {
        const input = document.getElementById('threadInput');
        if (!input || !currentThreadId) return;
        const message = input.value.trim();
        if (!message) return;
        if (!sessionToken) { alert('Please login to reply'); return; }

        try {
            const res = await fetch('/api/chat/thread/' + currentThreadId + '/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionToken },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            input.value = '';
            openThread(currentThreadId);
            loadCommunityThreads();
        } catch (e) {
            alert('Failed to send reply');
        }
    };

    window.openNewThreadModal = function() {
        const modal = document.getElementById('newThreadModal');
        const textarea = document.getElementById('newThreadText');
        if (modal) modal.style.display = 'flex';
        if (textarea) { textarea.value = ''; textarea.focus(); }
    };

    window.closeNewThreadModal = function() {
        const modal = document.getElementById('newThreadModal');
        if (modal) modal.style.display = 'none';
    };

    window.createThread = async function() {
        const textarea = document.getElementById('newThreadText');
        if (!textarea) return;
        const message = textarea.value.trim();
        if (!message) return;
        if (!sessionToken) { alert('Please login to start a thread'); return; }

        try {
            const res = await fetch('/api/chat/community', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionToken },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            closeNewThreadModal();
            loadCommunityThreads();
        } catch (e) {
            alert('Failed to create thread');
        }
    };

    // ---------- DMs ----------
    window.loadOnlineUsers = async function() {
        const container = document.getElementById('onlineUsers');
        if (!container) return;
        if (!sessionToken) { container.innerHTML = '<div style="color:#888;padding:12px;">Login to see online users</div>'; return; }
        try {
            const res = await fetch('/api/chat/online', { headers: { 'Authorization': 'Bearer ' + sessionToken } });
            if (!res.ok) return;
            const users = await res.json();
            if (users.length === 0) { container.innerHTML = '<div style="color:#888;padding:12px;">No one online right now</div>'; return; }
            container.innerHTML = users.map(u => `
                <div class="chat-convo-card" onclick="openDMInvite(${u.id}, '${escAttr(u.username)}')">
                    <div class="chat-avatar">${getAvatarHtml ? getAvatarHtml('', 0, 32) : ''}</div>
                    <div style="min-width:0;">
                        <div style="font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(u.username)}</div>
                        <div style="font-size:11px;color:#888;">Online</div>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error('loadOnlineUsers error', e); }
    };

    window.openDMInvite = function(userId, username) {
        if (!sessionToken) { alert('Please login to send messages'); return; }
        const modal = document.getElementById('dmInviteModal');
        const nameEl = document.getElementById('dmInviteUsername');
        const msgEl = document.getElementById('dmInviteMessage');
        if (nameEl) nameEl.textContent = username;
        if (msgEl) { msgEl.value = ''; msgEl.focus(); }
        if (modal) { modal.style.display = 'flex'; modal.dataset.userId = userId; }
    };

    window.closeDMInviteModal = function() {
        const modal = document.getElementById('dmInviteModal');
        if (modal) modal.style.display = 'none';
    };

    window.sendDMInvite = async function() {
        const modal = document.getElementById('dmInviteModal');
        const msgEl = document.getElementById('dmInviteMessage');
        if (!modal || !msgEl) return;
        const userId = modal.dataset.userId;
        const message = msgEl.value.trim();
        if (!message || !userId) return;

        try {
            const res = await fetch('/api/chat/dm/' + userId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionToken },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            closeDMInviteModal();
            switchChatTab('dms');
            openDMConversation(userId);
        } catch (e) { alert('Failed to send DM'); }
    };

    window.loadDMConversations = async function() {
        const container = document.getElementById('dmConversations');
        if (!container) return;
        if (!sessionToken) { container.innerHTML = '<div style="color:#888;padding:12px;">Login to see messages</div>'; return; }
        try {
            const res = await fetch('/api/chat/conversations', { headers: { 'Authorization': 'Bearer ' + sessionToken } });
            if (!res.ok) return;
            const convos = await res.json();
            if (convos.length === 0) { container.innerHTML = '<div style="color:#888;padding:12px;">No conversations yet. Click an online user to start one.</div>'; return; }
            container.innerHTML = convos.map(c => `
                <div class="chat-convo-card" id="dm-convo-${c.other_user_id}" onclick="openDMConversation(${c.other_user_id})">
                    <div class="chat-avatar">${getAvatarHtml ? getAvatarHtml('', 0, 32) : ''}</div>
                    <div style="min-width:0;flex:1;">
                        <div style="font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.other_username || 'Unknown')}</div>
                        <div style="font-size:12px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.last_message || '')}</div>
                        <div style="font-size:10px;color:#666;margin-top:2px;">${c.last_message_at ? formatTime(c.last_message_at) : ''}</div>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error('loadDMConversations error', e); }
    };

    window.openDMConversation = async function(userId) {
        currentDMUserId = userId;
        dmReplyToId = null;
        cancelDMReply();
        stopDMPolling();

        const header = document.getElementById('dmHeader');
        const inputArea = document.getElementById('dmInputArea');
        const messagesEl = document.getElementById('dmMessages');
        if (header) header.style.display = 'flex';
        if (inputArea) inputArea.style.display = 'flex';
        if (messagesEl) messagesEl.innerHTML = '<div style="color:#888;text-align:center;padding-top:40px;">Loading messages...</div>';

        try {
            const res = await fetch('/api/chat/dm/' + userId, { headers: { 'Authorization': 'Bearer ' + sessionToken } });
            const messages = await res.json();
            const other = messages.find(m => m.user_id !== currentUserId);
            const username = other ? other.username : 'User';
            if (header) header.innerHTML = '<span style="color:#888">To</span> <span id="dmUsername" style="color:#e50914;font-weight:700;">' + escHtml(username) + '</span>';

            const userIds = [...new Set(messages.map(m => m.user_id))];
            if (getUserAvatar) userIds.forEach(uid => getUserAvatar(uid));

            if (messagesEl) {
                messagesEl.innerHTML = messages.map(msg => renderDMMessage(msg)).join('');
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
            startDMPolling(userId);
        } catch (e) {
            if (messagesEl) messagesEl.innerHTML = '<div style="color:#e50914;text-align:center;padding-top:40px;">Failed to load messages</div>';
        }
    };

    function renderDMMessage(msg) {
        const isMe = msg.user_id === currentUserId;
        let replySnippet = '';
        if (msg.reply_to_id && msg.reply_to_message) {
            replySnippet = `
                <div class="chat-reply-snippet" style="margin-bottom:6px;cursor:pointer;" onclick="scrollToMessage(${msg.reply_to_id})">
                    <span style="color:#e50914">${escHtml(msg.reply_to_username || 'Unknown')}:</span> ${escHtml(msg.reply_to_message.substring(0, 60))}${msg.reply_to_message.length > 60 ? '...' : ''}
                </div>
            `;
        }
        return `
            <div class="chat-message-row ${isMe ? 'self' : ''}" id="dm-msg-${msg.id}">
                <div class="chat-avatar">${getAvatarHtml ? getAvatarHtml('', 0, 32) : ''}</div>
                <div class="chat-bubble ${isMe ? 'chat-bubble-self' : 'chat-bubble-other'}">
                    ${replySnippet}
                    <div>${escHtml(msg.message)}</div>
                    <div class="chat-meta" style="color:${isMe ? '#ffcccc' : '#888'};text-align:right;">${formatTime(msg.created_at)}</div>
                </div>
                <div style="align-self:flex-end;margin:0 4px;cursor:pointer;color:#666;font-size:11px;" onclick="setDMReply(${msg.id}, '${escAttr(msg.username)}', '${escAttr(msg.message)}')">↩</div>
            </div>
        `;
    }

    function startDMPolling(userId) {
        if (dmPollInterval) clearInterval(dmPollInterval);
        dmPollInterval = setInterval(() => {
            if (currentDMUserId === userId) openDMConversation(userId);
        }, 4000);
    }

    function stopDMPolling() {
        if (dmPollInterval) { clearInterval(dmPollInterval); dmPollInterval = null; }
    }

    window.setDMReply = function(msgId, username, message) {
        dmReplyToId = msgId;
        const preview = document.getElementById('dmReplyPreview');
        const text = document.getElementById('dmReplyPreviewText');
        if (preview && text) {
            text.textContent = `↩ ${username}: ${message.substring(0, 60)}${message.length > 60 ? '...' : ''}`;
            preview.style.display = 'block';
        }
    };

    window.cancelDMReply = function() {
        dmReplyToId = null;
        const preview = document.getElementById('dmReplyPreview');
        if (preview) preview.style.display = 'none';
    };

    window.sendDM = async function() {
        const input = document.getElementById('dmInput');
        if (!input || !currentDMUserId) return;
        const message = input.value.trim();
        if (!message) return;
        if (!sessionToken) { alert('Please login to send messages'); return; }

        try {
            const body = { message };
            if (dmReplyToId) body.replyToId = dmReplyToId;
            const res = await fetch('/api/chat/dm/' + currentDMUserId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionToken },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            input.value = '';
            cancelDMReply();
            openDMConversation(currentDMUserId);
        } catch (e) { alert('Failed to send DM'); }
    };

    window.scrollToMessage = function(msgId) {
        const el = document.getElementById('dm-msg-' + msgId);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight-pulse'); setTimeout(() => el.classList.remove('highlight-pulse'), 1200); }
    };
})();
