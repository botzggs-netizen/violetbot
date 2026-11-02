const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const P = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

// =====================================
// CONFIGURATION
// =====================================

const BOT_NAME = '【𝑽𝒊𝒐𝒍𝒆𝒕 𝑩𝒐𝒕】';
const OWNER_NAME = 'Sera Violet';
const PREFIX = '.';

const AUTH_FOLDER = './auth';
const SETTINGS_FILE = './group-settings.json';
const BANNER_FILE = './banner.jpg';
const START_TIME = Date.now();

let groupSettings = {};

if (fs.existsSync(SETTINGS_FILE)) {
    try {
        groupSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (error) {
        console.error('Could not read group settings:', error.message);
        groupSettings = {};
    }
}

function saveSettings() {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(groupSettings, null, 2));
}

function isBotOn(groupId) {
    return groupSettings[groupId] === true;
}

function formatUptime() {
    const total = Math.floor((Date.now() - START_TIME) / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    return [hours, minutes, seconds]
        .map(value => String(value).padStart(2, '0'))
        .join(':');
}

// =====================================
// WHATSAPP ID HELPERS (JID / LID)
// =====================================

function cleanId(id) {
    if (typeof id !== 'string' || !id) return null;

    return id
        .trim()
        .toLowerCase()
        .replace(/:\d+(?=@)/, '');
}

function idsMatch(a, b) {
    const first = cleanId(a);
    const second = cleanId(b);

    if (!first || !second) return false;
    if (first === second) return true;

    const firstAt = first.lastIndexOf('@');
    const secondAt = second.lastIndexOf('@');

    if (firstAt < 0 || secondAt < 0) return false;

    const firstDomain = first.slice(firstAt + 1);
    const secondDomain = second.slice(secondAt + 1);

    return firstDomain === secondDomain &&
        first.slice(0, firstAt) === second.slice(0, secondAt);
}

function participantIds(participant) {
    return [
        participant?.id,
        participant?.lid,
        participant?.phoneNumber
    ].filter(Boolean);
}

function findParticipant(metadata, candidateIds) {
    return metadata.participants.find(participant =>
        participantIds(participant).some(participantId =>
            candidateIds.some(candidateId =>
                idsMatch(participantId, candidateId)
            )
        )
    );
}

function getSenderIds(msg) {
    return [
        msg.key?.participant,
        msg.key?.participantAlt,
        msg.participant,
        msg.participantAlt
    ].filter(Boolean);
}

function getBotIds(sock) {
    return [
        sock.user?.id,
        sock.user?.lid
    ].filter(Boolean);
}

async function getGroupMetadata(sock, groupId) {
    return sock.groupMetadata(groupId);
}

async function isGroupAdmin(sock, groupId, senderIds) {
    try {
        const metadata = await getGroupMetadata(sock, groupId);
        const participant = findParticipant(metadata, senderIds);

        return participant?.admin === 'admin' ||
            participant?.admin === 'superadmin';
    } catch (error) {
        console.error('[ADMIN CHECK] Failed:', error.message);
        return false;
    }
}

async function isBotAdmin(sock, groupId) {
    try {
        const metadata = await getGroupMetadata(sock, groupId);
        const participant = findParticipant(metadata, getBotIds(sock));

        return participant?.admin === 'admin' ||
            participant?.admin === 'superadmin';
    } catch (error) {
        console.error('[BOT ADMIN CHECK] Failed:', error.message);
        return false;
    }
}

// =====================================
// MESSAGE HELPERS
// =====================================

function unwrapMessage(message) {
    let current = message;

    while (current) {
        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
        } else if (current.viewOnceMessage?.message) {
            current = current.viewOnceMessage.message;
        } else if (current.viewOnceMessageV2?.message) {
            current = current.viewOnceMessageV2.message;
        } else {
            break;
        }
    }

    return current || {};
}

function getMessageText(msg) {
    const message = unwrapMessage(msg.message);

    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.buttonsResponseMessage?.selectedButtonId ||
        message.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    ).trim();
}

function getContextInfo(msg) {
    const message = unwrapMessage(msg.message);

    return message.extendedTextMessage?.contextInfo ||
        message.imageMessage?.contextInfo ||
        message.videoMessage?.contextInfo ||
        message.documentMessage?.contextInfo || {};
}

function getMentions(msg) {
    return getContextInfo(msg).mentionedJid || [];
}

function getQuotedSenderIds(msg) {
    const context = getContextInfo(msg);

    return [
        context.participant,
        context.participantAlt
    ].filter(Boolean);
}

// =====================================
// MENU
// =====================================

async function sendMenu(sock, chatId, msg, isGroup) {
    let groupCount = 0;

    try {
        const groups = await sock.groupFetchAllParticipating();
        groupCount = Object.keys(groups).length;
    } catch (error) {
        console.error('[MENU] Group count failed:', error.message);
    }

    const status = isGroup
        ? (isBotOn(chatId) ? 'ON' : 'OFF')
        : 'READY';

    const menuText = `
⌦═════════════════⌫
👑 *Dashboard ${BOT_NAME}*

💬 Hello! I’m ${BOT_NAME}, and I’m here to help you.

📊 *BOT STATUS:*
🔰 Status: ${status}
⏱️ Uptime: ${formatUptime()}
👥 Total Groups: ${groupCount}

📌 *GENERAL COMMANDS:*
◆.menu
◆.ping
◆.getpp

🛡️ *GROUP ADMIN COMMANDS:*
◆.boton
◆.botoff
◆.kick @user
◆.close
◆.open

✨ *Feature Command* 
◆.pin "name"

👤 *BOT INFORMATION:*
◆Name: ${BOT_NAME}
◆Owner: ${OWNER_NAME}
◆Prefix: ${PREFIX}
⌦═════════════════⌫

> ${BOT_NAME} © 2026`.trim();

    if (fs.existsSync(BANNER_FILE)) {
        await sock.sendMessage(chatId, {
            image: fs.readFileSync(BANNER_FILE),
            caption: menuText
        }, { quoted: msg });
    } else {
        await sock.sendMessage(chatId, {
            text: menuText + '\n\n⚠️ Banner image not found.'
        }, { quoted: msg });
    }
}

// =====================================
// PIN SEARCH
// =====================================

async function searchPinterest(sock, chatId, msg, keyword) {
    if (!keyword || !keyword.trim()) {
        await sock.sendMessage(chatId, {
            text: 'Usage: .pin <keyword>\nExample: .pin anime scenery'
        }, { quoted: msg });
        return;
    }

    const token = process.env.PINTEREST_ACCESS_TOKEN;

    if (!token) {
        await sock.sendMessage(chatId, {
            text: 'Pinterest API token is not configured.'
        }, { quoted: msg });
        return;
    }

    try {
        const params = new URLSearchParams({
            term: keyword.trim(),
            country_code: 'ID',
            limit: '10'
        });

        const response = await fetch(
            `https://api.pinterest.com/v5/search/partner/pins?${params}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Pinterest API error: ${response.status}`);
        }

        const data = await response.json();

        const pins = (data.items || []).slice(0, 6);

        if (!pins.length) {
            await sock.sendMessage(chatId, {
                text: 'No Pins found for that keyword.'
            }, { quoted: msg });
            return;
        }

        for (const pin of pins) {
            const images = pin.media?.images || {};
            const imageUrl =
                images['1200x']?.url ||
                images['600x']?.url ||
                images.originals?.url;

            if (!imageUrl) continue;

            await sock.sendMessage(chatId, {
                image: { url: imageUrl },
                caption: pin.title || 'Pinterest Pin'
            }, { quoted: msg });
        }

    } catch (error) {
        console.error('[PINTEREST ERROR]', error);

        await sock.sendMessage(chatId, {
            text: 'Pinterest search failed. Please try again later.'
        }, { quoted: msg });
    }
}
// =====================================
// COMMAND HANDLER
// =====================================

async function handleMessage(sock, msg) {
    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;

    if (!chatId ||
        chatId === 'status@broadcast' ||
        chatId.endsWith('@newsletter')) return;

    const isGroup = chatId.endsWith('@g.us');
    const text = getMessageText(msg);

    if (!text.startsWith(PREFIX)) return;

    const parts = text.slice(PREFIX.length).trim().split(/\s+/);
    const command = (parts.shift() || '').toLowerCase();

    if (!command) return;

    // When OFF, only .boton is accepted in groups.
    if (isGroup && !isBotOn(chatId) && command !== 'boton') {
        return;
    }

    const senderIds = getSenderIds(msg);
    const mentions = getMentions(msg);

    // ---------------------------------
    // GENERAL COMMANDS
    // ---------------------------------

    if (command === 'menu') {
        await sendMenu(sock, chatId, msg, isGroup);
        return;
    }

    if (command === 'ping') {
        await sock.sendMessage(chatId, {
            text: `Pong! ${BOT_NAME} is active.`
        }, { quoted: msg });

        return;
    }

    if (command === 'getpp') {
        // Priority: mention > reply > command sender.
        const quotedIds = getQuotedSenderIds(msg);

        let targetIds = mentions.length
            ? [mentions[0]]
            : quotedIds;

        if (!targetIds.length) {
            targetIds = senderIds;
        }

        const metadata = isGroup
            ? await sock.groupMetadata(chatId).catch(() => null)
            : null;

        const targetParticipant = metadata
            ? findParticipant(metadata, targetIds)
            : null;

        const target = targetParticipant?.id || targetIds[0];

        try {
            const ppUrl = await sock.profilePictureUrl(target, 'image');

            await sock.sendMessage(chatId, {
                image: { url: ppUrl },
                caption: 'Profile picture'
            }, { quoted: msg });

        } catch (error) {
            console.error('[GETPP] Failed:', error.message);

            await sock.sendMessage(chatId, {
                text: 'The profile picture could not be found or accessed.'
            }, { quoted: msg });
        }

        return;
    }
    
    // ---------------------------------
    // Feature command
    // ---------------------------------
    if (command === 'pin') {
    await searchPinterest(
        sock,
        chatId,
        msg,
        parts.join(' ')
    );

    return;
}


    // ---------------------------------
    // GROUP ADMIN COMMANDS
    // ---------------------------------

    const adminCommands = [
        'boton',
        'botoff',
        'kick',
        'close',
        'open'
    ];

    if (!adminCommands.includes(command)) return;

    if (!isGroup) {
        await sock.sendMessage(chatId, {
            text: 'This command can only be used in groups.'
        }, { quoted: msg });

        return;
    }

    // Check whether the sender is an admin in this specific group.
    const senderIsAdmin = await isGroupAdmin(
        sock,
        chatId,
        senderIds
    );

    if (!senderIsAdmin) {
        await sock.sendMessage(chatId, {
            text: 'Only group admins can use this command.'
        }, { quoted: msg });

        return;
    }

    // ---------------------------------
    // BOT ON / OFF
    // ---------------------------------

    if (command === 'boton') {
        groupSettings[chatId] = true;
        saveSettings();

        await sock.sendMessage(chatId, {
            text: '✅ Violet Bot has been enabled.'
        }, { quoted: msg });

        return;
    }

    if (command === 'botoff') {
        groupSettings[chatId] = false;
        saveSettings();

        await sock.sendMessage(chatId, {
            text: '🔴 Violet Bot has been disabled.'
        }, { quoted: msg });

        return;
    }

    // ---------------------------------
    // BOT ADMIN CHECK
    // ---------------------------------

    const botIsAdmin = await isBotAdmin(sock, chatId);

    if (!botIsAdmin) {
        await sock.sendMessage(chatId, {
            text: 'Violet Bot is not recognized as a group admin. Please make the bot a group admin first.'
        }, { quoted: msg });

        return;
    }

    // ---------------------------------
    // KICK
    // ---------------------------------

    if (command === 'kick') {
        const quotedIds = getQuotedSenderIds(msg);

        // Priority: mention, then reply.
        const targetIds = mentions.length
            ? [mentions[0]]
            : quotedIds;

        if (!targetIds.length) {
            await sock.sendMessage(chatId, {
                text: 'Mention a member or reply to their message, then use .kick.\nExample: .kick @user'
            }, { quoted: msg });

            return;
        }

        const metadata = await sock.groupMetadata(chatId);

        const targetParticipant = findParticipant(
            metadata,
            targetIds
        );

        if (!targetParticipant) {
            await sock.sendMessage(chatId, {
                text: 'The selected member could not be found in this group.'
            }, { quoted: msg });

            return;
        }

        // Protect the group owner, but allow regular admins to be targeted.
        if (targetParticipant.admin === 'superadmin') {
            await sock.sendMessage(chatId, {
                text: 'The group owner cannot be removed by this command.'
            }, { quoted: msg });

            return;
        }

        try {
            const result = await sock.groupParticipantsUpdate(
                chatId,
                [targetParticipant.id],
                'remove'
            );

            console.log('[KICK] WhatsApp response:', result);

            const failed = Array.isArray(result) &&
                result.some(item =>
                    item.status && String(item.status) !== '200'
                );

            await sock.sendMessage(chatId, {
                text: failed
                    ? '❌ WhatsApp rejected the removal request. Check the bot\'s group permissions.'
                    : '✅ The removal request was sent successfully.'
            }, { quoted: msg });

        } catch (error) {
            console.error('[KICK ERROR]', error);

            await sock.sendMessage(chatId, {
                text: "❌ Failed to remove the member. Check the bot's group permissions."
            }, { quoted: msg });
        }

        return;
    }

    // ---------------------------------
    // CLOSE GROUP
    // ---------------------------------

    if (command === 'close') {
        await sock.groupSettingUpdate(
            chatId,
            'announcement'
        );

        await sock.sendMessage(chatId, {
            text: '🔒 The group is now closed. Only admins can send messages.'
        }, { quoted: msg });

        return;
    }

    // ---------------------------------
    // OPEN GROUP
    // ---------------------------------

    if (command === 'open') {
        await sock.groupSettingUpdate(
            chatId,
            'not_announcement'
        );

        await sock.sendMessage(chatId, {
            text: '🔓 The group is now open. All members can send messages.'
        }, { quoted: msg });
    }
}

// =====================================
// START BOT / RECONNECT
// =====================================

let reconnectTimer = null;
let isStarting = false;

async function startBot() {
    if (isStarting) return;

    isStarting = true;

    try {
        console.log('Starting Violet Bot...');

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(AUTH_FOLDER);

        let version;

        try {
            const latest = await fetchLatestBaileysVersion();

            version = latest.version;

            console.log(
                'WhatsApp Web version:',
                version.join('.')
            );

        } catch (error) {
            console.log(
                'Could not fetch latest WhatsApp version:',
                error.message
            );
        }

        const sock = makeWASocket({
            ...(version ? { version } : {}),
            auth: state,
            browser: Browsers.macOS('Desktop'),
            logger: P({ level: 'silent' }),
            markOnlineOnConnect: false
        });

        isStarting = false;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on(
            'connection.update',
            async ({ connection, lastDisconnect, qr }) => {

                if (qr) {
                    try {
                        await QRCode.toFile(
                            './violet-qr.png',
                            qr,
                            {
                                width: 600,
                                margin: 2
                            }
                        );

                        console.log('QR saved: violet-qr.png');

                    } catch (error) {
                        console.error(
                            'QR creation failed:',
                            error.message
                        );
                    }
                }

                if (connection === 'connecting') {
                    console.log('Connecting to WhatsApp...');
                }

                if (connection === 'open') {
                    if (reconnectTimer) {
                        clearTimeout(reconnectTimer);
                    }

                    reconnectTimer = null;

                    console.log(`${BOT_NAME} is online!`);
                }

                if (connection === 'close') {
                    const error = lastDisconnect?.error;
                    const code = error?.output?.statusCode;

                    console.log(
                        'Connection closed. Status:',
                        code
                    );

                    console.log(
                        'Reason:',
                        error?.message || error
                    );

                    if (code === DisconnectReason.loggedOut) {
                        console.log(
                            'Session logged out. Pair the device again.'
                        );

                        return;
                    }

                    if (!reconnectTimer) {
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;

                            startBot().catch(err =>
                                console.error('Reconnect failed:', err)
                            );

                        }, 5000);

                        console.log('Reconnecting in 5 seconds...');
                    }
                }
            }
        );

        // ---------------------------------
        // INCOMING MESSAGES
        // ---------------------------------

        sock.ev.on(
            'messages.upsert',
            async ({ messages, type }) => {

                if (type !== 'notify') return;

                for (const msg of messages) {
                    try {
                        await handleMessage(sock, msg);

                    } catch (error) {
                        console.error(
                            '[COMMAND ERROR]',
                            error
                        );

                        await sock.sendMessage(
                            msg.key.remoteJid,
                            {
                                text: `Command failed: ${error.message || 'Unknown error'}`
                            }
                        ).catch(() => {});
                    }
                }
            }
        );

    } catch (error) {
        isStarting = false;

        console.error(
            'Fatal startup error:',
            error
        );

        if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;

                startBot().catch(err =>
                    console.error('Restart failed:', err)
                );

            }, 5000);
        }
    }
}

startBot().catch(error =>
    console.error('Fatal error:', error)
);