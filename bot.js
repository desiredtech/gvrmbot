const {
    Client, GatewayIntentBits, Partials, REST, Routes,
    SlashCommandBuilder, EmbedBuilder, AttachmentBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    PermissionFlagsBits, ChannelType
} = require('discord.js');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) throw new Error('DISCORD_TOKEN environment variable is not set.');

const LOG_CHANNEL_ID = '1478874724665659664';
const EA_ACCESS_ROLES = ['1478874545715679486', '1478874597901467720', '1478874602997289002'];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

const startupMessages = new Map();
const eaLinks = new Map();

async function sendLog(guild, embed) {
    try {
        const channel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Failed to send log:', err);
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('View the server membercount of the server.')
        .toJSON(),

    new SlashCommandBuilder()
        .setName('startup')
        .setDescription('Starts up a GVRM Session.')
        .addIntegerOption(option =>
            option
                .setName('reactions')
                .setDescription('How many reactions are needed to commence the session?')
                .setRequired(true)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('ea')
        .setDescription('Release early access for your roleplay session.')
        .addStringOption(option =>
            option
                .setName('link')
                .setDescription('The Roblox session link for early access.')
                .setRequired(true)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('release')
        .setDescription('Officially release your roleplay session.')
        .addStringOption(option =>
            option
                .setName('link')
                .setDescription('The Roblox session link.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('frl')
                .setDescription('Fail-Roleplay Limit')
                .setRequired(true)
                .addChoices(
                    { name: '65', value: '65' },
                    { name: '75', value: '75' },
                    { name: '90', value: '90' }
                )
        )
        .addStringOption(option =>
            option
                .setName('peacetime')
                .setDescription('Peacetime Status')
                .setRequired(true)
                .addChoices(
                    { name: 'Strict Peacetime', value: 'Strict Peacetime' },
                    { name: 'Normal Peacetime', value: 'Normal Peacetime' },
                    { name: 'Peacetime Off', value: 'Peacetime Off' }
                )
        )
        .addStringOption(option =>
            option
                .setName('emergency')
                .setDescription('Emergency Services')
                .setRequired(true)
                .addChoices(
                    { name: 'Online', value: 'Online' },
                    { name: 'Offline', value: 'Offline' }
                )
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('reinvites')
        .setDescription('Announce session re-invites for your roleplay session.')
        .addStringOption(option =>
            option
                .setName('link')
                .setDescription('The Roblox session link.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('frl')
                .setDescription('Fail-Roleplay Limit')
                .setRequired(true)
                .addChoices(
                    { name: '65', value: '65' },
                    { name: '75', value: '75' },
                    { name: '90', value: '90' }
                )
        )
        .addStringOption(option =>
            option
                .setName('peacetime')
                .setDescription('Peacetime Status')
                .setRequired(true)
                .addChoices(
                    { name: 'Strict Peacetime', value: 'Strict Peacetime' },
                    { name: 'Normal Peacetime', value: 'Normal Peacetime' },
                    { name: 'Peacetime Off', value: 'Peacetime Off' }
                )
        )
        .addStringOption(option =>
            option
                .setName('emergency')
                .setDescription('Emergency Services')
                .setRequired(true)
                .addChoices(
                    { name: 'Online', value: 'Online' },
                    { name: 'Offline', value: 'Offline' }
                )
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Send a custom embed message.')
        .addStringOption(option =>
            option
                .setName('statement')
                .setDescription('The text/statement to display in the embed.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('image')
                .setDescription('A direct image URL to display in the embed.')
                .setRequired(false)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Send the ticket support panel.')
        .toJSON(),

    new SlashCommandBuilder()
        .setName('regen')
        .setDescription('Announce that the session link has been regenerated.')
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log('Cleared global commands.');
    } catch (error) {
        console.error('Error clearing global commands:', error);
    }

    try {
        await client.guilds.fetch();
    } catch (error) {
        console.error('Error fetching guilds:', error);
    }

    console.log(`Registering commands in ${client.guilds.cache.size} guild(s)...`);

    for (const guild of client.guilds.cache.values()) {
        try {
            console.log(`Registering slash commands for guild: ${guild.name} (${guild.id})`);
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body: commands }
            );
            console.log(`Slash commands registered for guild: ${guild.name}`);
        } catch (error) {
            console.error(`Error registering commands for guild ${guild.name}:`, error);
        }
    }

    console.log(`Done registering ${commands.length} commands.`);
});

client.on('guildCreate', async (guild) => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guild.id),
            { body: commands }
        );
        console.log(`Slash commands registered for new guild: ${guild.name}`);
    } catch (error) {
        console.error(`Error registering commands for new guild ${guild.name}:`, error);
    }
});

// ── Logging Events ────────────────────────────────────────────────────────────

client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .setColor(0xffffc5)
        .addFields(
            { name: 'Author', value: message.author ? `${message.author} (${message.author.tag})` : 'Unknown', inline: true },
            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
            { name: 'Content', value: message.content || '*(no text content)*' }
        )
        .setTimestamp();

    await sendLog(message.guild, embed);
});

client.on('guildMemberAdd', async (member) => {
    const embed = new EmbedBuilder()
        .setTitle('Member Joined')
        .setColor(0xffffc5)
        .addFields(
            { name: 'User', value: `${member.user} (${member.user.tag})`, inline: true },
            { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

    await sendLog(member.guild, embed);
});

client.on('guildMemberRemove', async (member) => {
    const embed = new EmbedBuilder()
        .setTitle('Member Left')
        .setColor(0xffffc5)
        .addFields(
            { name: 'User', value: `${member.user} (${member.user.tag})`, inline: true },
            { name: 'Roles', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'None' }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

    await sendLog(member.guild, embed);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setTitle('Role Added')
            .setColor(0xffffc5)
            .addFields(
                { name: 'User', value: `${newMember.user} (${newMember.user.tag})`, inline: true },
                { name: 'Role(s) Added', value: addedRoles.map(r => `<@&${r.id}>`).join(', ') }
            )
            .setTimestamp();

        await sendLog(newMember.guild, embed);
    }

    if (removedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setTitle('Role Removed')
            .setColor(0xffffc5)
            .addFields(
                { name: 'User', value: `${newMember.user} (${newMember.user.tag})`, inline: true },
                { name: 'Role(s) Removed', value: removedRoles.map(r => `<@&${r.id}>`).join(', ') }
            )
            .setTimestamp();

        await sendLog(newMember.guild, embed);
    }

    if (oldMember.nickname !== newMember.nickname) {
        const embed = new EmbedBuilder()
            .setTitle('Nickname Changed')
            .setColor(0xffffc5)
            .addFields(
                { name: 'User', value: `${newMember.user} (${newMember.user.tag})`, inline: true },
                { name: 'Before', value: oldMember.nickname || '*None*', inline: true },
                { name: 'After', value: newMember.nickname || '*None*', inline: true }
            )
            .setTimestamp();

        await sendLog(newMember.guild, embed);
    }
});

client.on('guildBanAdd', async (ban) => {
    const embed = new EmbedBuilder()
        .setTitle('Member Banned')
        .setColor(0xffffc5)
        .addFields(
            { name: 'User', value: `${ban.user} (${ban.user.tag})`, inline: true },
            { name: 'Reason', value: ban.reason || 'No reason provided' }
        )
        .setThumbnail(ban.user.displayAvatarURL())
        .setTimestamp();

    await sendLog(ban.guild, embed);
});

client.on('guildBanRemove', async (ban) => {
    const embed = new EmbedBuilder()
        .setTitle('Member Unbanned')
        .setColor(0xffffc5)
        .addFields(
            { name: 'User', value: `${ban.user} (${ban.user.tag})`, inline: true }
        )
        .setThumbnail(ban.user.displayAvatarURL())
        .setTimestamp();

    await sendLog(ban.guild, embed);
});

client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('Channel Created')
        .setColor(0xffffc5)
        .addFields({ name: 'Channel', value: `<#${channel.id}> (${channel.name})` })
        .setTimestamp();

    await sendLog(channel.guild, embed);
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('Channel Deleted')
        .setColor(0xffffc5)
        .addFields({ name: 'Channel', value: `#${channel.name}` })
        .setTimestamp();

    await sendLog(channel.guild, embed);
});

// ── Commands & Buttons ────────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {

    console.log(`[INTERACTION] type=${interaction.type} customId=${interaction.customId ?? 'none'} hasValues=${Array.isArray(interaction.values)} isCmd=${interaction.isChatInputCommand?.()}`);

    // ── Select Menu ───────────────────────────────────────────────────────────
    if (interaction.customId === 'ticket_type' && Array.isArray(interaction.values)) {
        console.log(`[TICKET] Select menu triggered by ${interaction.user?.tag}, value: ${interaction.values[0]}`);
        const type = interaction.values[0];
        const user = interaction.user;
        const guild = interaction.guild;

        if (openTickets.has(user.id)) {
            const existingChannelId = openTickets.get(user.id);
            return interaction.reply({
                content: `You already have an open ticket. Please head to <#${existingChannelId}>.`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const staffRole = guild.roles.cache.find(r => r.name === 'Staff Team');

            const permissionOverwrites = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                {
                    id: user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                }
            ];

            if (staffRole) {
                permissionOverwrites.push({
                    id: staffRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
                });
            }

            const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType?.GuildText ?? 0,
                permissionOverwrites
            });

            openTickets.set(user.id, ticketChannel.id);
            ticketData.set(ticketChannel.id, { userId: user.id, type, openedAt: new Date() });

            const isGeneral = type === 'general';
            const formatText = isGeneral
                ? `Welcome to **Mission** General Support, please be patient as one of our staff members reviews this ticket accordingly. Utilize the format below.\n\nUser: (your username)\nInquire: (describe your inquiry)\nDate: (today's date)`
                : `Welcome to **Mission** Member Report, please be patient as one of our staff members reviews this ticket accordingly. Utilize the format below.\n\nUser: (your username)\nMember Report: (who you are reporting and why)\nEvidence: (provide your evidence)\nDate: (today's date)`;

            const ticketEmbed = new EmbedBuilder()
                .setDescription(formatText)
                .setColor(0xffffc5);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({
                content: `${user}${staffRole ? ` | ${staffRole}` : ''}`,
                embeds: [ticketEmbed],
                components: [row]
            });

            await interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
        } catch (err) {
            console.error('[TICKET ERROR] Error creating ticket:', err);
            await interaction.editReply({ content: `Something went wrong: ${err.message}` });
        }
        return;
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
        // Early access link
        if (interaction.customId.startsWith('ea_link:')) {
            const messageId = interaction.customId.split(':')[1];
            const link = eaLinks.get(messageId);
            const hasAccess = interaction.member.roles.cache.some(role => EA_ACCESS_ROLES.includes(role.id));
            if (!hasAccess) return interaction.reply({ content: 'You do not have permission to access this link.', ephemeral: true });
            return interaction.reply({ content: link ?? 'Link unavailable.', ephemeral: true });
        }

        // Ticket claim
        if (interaction.customId === 'ticket_claim') {
            const hasStaffRole = interaction.member.roles.cache.some(r => r.name === 'Staff Team');
            if (!hasStaffRole) return interaction.reply({ content: 'Only Staff Team members can claim tickets.', ephemeral: true });

            await interaction.deferUpdate();

            const claimedEmbed = new EmbedBuilder()
                .setDescription(`${interaction.user} has now **claimed** this ticket.`)
                .setColor(0xffffc5);

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claimed').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
            );

            await interaction.message.edit({ components: [updatedRow] });
            await interaction.channel.send({ embeds: [claimedEmbed] });
            return;
        }

        // Ticket close — show confirmation
        if (interaction.customId === 'ticket_close') {
            const data = ticketData.get(interaction.channel.id);
            if (!data) return interaction.reply({ content: 'This does not appear to be a ticket channel.', ephemeral: true });

            const isOwner = interaction.user.id === data.userId;
            const hasStaffRole = interaction.member.roles.cache.some(r => r.name === 'Staff Team');
            if (!isOwner && !hasStaffRole) return interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });

            const confirmEmbed = new EmbedBuilder()
                .setDescription('Are you sure you want to close this ticket? This action cannot be undone.')
                .setColor(0xffffc5);

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });
            return;
        }

        // Ticket close — cancel
        if (interaction.customId === 'ticket_close_cancel') {
            await interaction.message.delete().catch(() => null);
            await interaction.deferUpdate().catch(() => null);
            return;
        }

        // Ticket close — confirm
        if (interaction.customId === 'ticket_close_confirm') {
            const data = ticketData.get(interaction.channel.id);
            if (!data) return interaction.reply({ content: 'Ticket data not found.', ephemeral: true });

            await interaction.deferUpdate();

            try {
                await interaction.channel.send({
                    embeds: [new EmbedBuilder().setDescription('This ticket is now being closed. Generating transcript...').setColor(0xffffc5)]
                });

                const messages = await fetchAllMessages(interaction.channel);
                const closedAt = new Date();

                const transcriptLines = [
                    `Ticket Transcript`,
                    `Channel: #${interaction.channel.name}`,
                    `Type: ${data.type === 'general' ? 'General Support' : 'Member Report'}`,
                    `Opened: ${data.openedAt.toUTCString()}`,
                    `Closed: ${closedAt.toUTCString()}`,
                    ``,
                    `--- Messages ---`,
                    ``
                ];

                for (const msg of messages) {
                    const timestamp = new Date(msg.createdTimestamp).toUTCString();
                    const content = msg.content || (msg.embeds.length ? '[embed]' : '[attachment]');
                    transcriptLines.push(`[${timestamp}] ${msg.author.tag}: ${content}`);
                }

                const transcriptBuffer = Buffer.from(transcriptLines.join('\n'), 'utf-8');
                const transcriptFile = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` });

                const transcriptLogChannel = await interaction.guild.channels.fetch(TRANSCRIPT_CHANNEL_ID).catch(() => null);
                if (transcriptLogChannel?.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setDescription(
                            `**Ticket Closed**\n\n` +
                            `Channel: #${interaction.channel.name}\n` +
                            `Type: ${data.type === 'general' ? 'General Support' : 'Member Report'}\n` +
                            `Opened by: <@${data.userId}>\n` +
                            `Closed by: ${interaction.user}\n` +
                            `Opened: ${data.openedAt.toUTCString()}\n` +
                            `Closed: ${closedAt.toUTCString()}`
                        )
                        .setColor(0xffffc5);

                    await transcriptLogChannel.send({ embeds: [logEmbed], files: [transcriptFile] });
                }

                try {
                    const dmTranscriptFile = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` });
                    const ticketUser = await client.users.fetch(data.userId);
                    await ticketUser.send({
                        embeds: [new EmbedBuilder()
                            .setDescription(
                                `Thank you for reaching out to **Greenville Roleplay Mission**!\n\n` +
                                `We hope that your inquiry has been resolved to your satisfaction. Our staff team works diligently to ensure every member of the Greenville Roleplay Mission community receives the assistance they deserve in a timely and professional manner.\n\n` +
                                `Your ticket has now been officially closed, and a full transcript of your conversation has been attached to this message for your records. Should you require any further assistance in the future, please do not hesitate to open another ticket — we are always happy to help.\n\n` +
                                `We truly appreciate your patience and your continued support of the Greenville Roleplay Mission community. We hope to see you on the roads!`
                            )
                            .setColor(0xffffc5)
                        ],
                        files: [dmTranscriptFile]
                    });
                } catch {
                    console.error('Could not DM ticket user — they may have DMs disabled.');
                }

                openTickets.delete(data.userId);
                ticketData.delete(interaction.channel.id);

                setTimeout(() => {
                    interaction.channel.delete().catch(err => console.error('Failed to delete ticket channel:', err));
                }, 3000);

            } catch (err) {
                console.error('Error closing ticket:', err);
                await interaction.channel.send({ content: `Something went wrong while closing: ${err.message}` });
            }
            return;
        }

        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'membercount') {
        const guild = interaction.guild;

        if (!guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        await guild.members.fetch();
        const memberCount = guild.memberCount;

        const embed = new EmbedBuilder()
            .setTitle('Members')
            .setDescription(`**${memberCount}**`)
            .setColor(0xffffc5)
            .setFooter({ text: 'Members' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'startup') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const reactions = interaction.options.getInteger('reactions');
        const host = interaction.user;

        const attachment = new AttachmentBuilder(path.join(__dirname, 'startup.png'), { name: 'startup.png' });

        const embed = new EmbedBuilder()
            .setDescription(
                `<:car:1479984910377812192>  **Greenville Roleplay Mission** — **Session Startup!**  <:car:1479984910377812192>\n\n` +
                `<:curvedline:1480604557930397838> ${host} is hosting a **Mission** roleplay session! In order to join this **immersive** session-roleplay, please ensure you have read & familiarised yourself within <#1478874657481294017> and follow these **guidelines** in the future. Please check to make sure your vehicle isn't a banned vehicle to avoid **further** moderation actions.\n\n` +
                `<:curvedline:1480604557930397838> For this session to **commence**, we must achieve the goal of **${reactions}** reactions.`
            )
            .setColor(0xffffc5)
            .setImage('attachment://startup.png')
            .setTimestamp();

        await interaction.deferReply({ ephemeral: true });

        const message = await interaction.channel.send({
            content: `<@&1478874601445396725>`,
            embeds: [embed],
            files: [attachment]
        });

        await message.react('<:checkmark:1480604103645331467>');

        startupMessages.set(message.id, { required: reactions, triggered: false });

        await interaction.editReply({ content: 'Session startup posted!', ephemeral: true });
    }

    if (interaction.commandName === 'ea') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const link = interaction.options.getString('link');
        const host = interaction.user;

        await interaction.deferReply({ ephemeral: true });

        const eaAttachment = new AttachmentBuilder(path.join(__dirname, 'ea.png'), { name: 'ea.png' });

        const embed = new EmbedBuilder()
            .setDescription(
                `<:car:1479984910377812192>  **Greenville Roleplay Mission** — **Early Access!** <:car:1479984910377812192>\n\n` +
                `<:curvedline:1480604557930397838> ${host} has released early access for their roleplay session. If you have access to the button below, you may begin joining now before the session link is closed. Once you're in-game, please park your vehicle and wait for further instructions from staff.`
            )
            .setColor(0xffffc5)
            .setImage('attachment://ea.png')
            .setTimestamp();

        const message = await interaction.channel.send({
            content: `<@&1478874545715679486> <@&1478874597901467720> <@&1478874602997289002>`,
            embeds: [embed],
            files: [eaAttachment],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ea_link:placeholder`)
                        .setLabel('Link')
                        .setEmoji({ id: '1482744239518388260', name: 'link2' })
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });

        eaLinks.set(message.id, link);

        await message.edit({
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ea_link:${message.id}`)
                        .setLabel('Link')
                        .setEmoji({ id: '1482744239518388260', name: 'link2' })
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });

        await interaction.editReply({ content: 'Early access posted!', ephemeral: true });
    }

    if (interaction.commandName === 'release') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const link = interaction.options.getString('link');
        const frl = interaction.options.getString('frl');
        const peacetime = interaction.options.getString('peacetime');
        const emergency = interaction.options.getString('emergency');
        const host = interaction.user;

        await interaction.deferReply({ ephemeral: true });

        try {
            const safeLink = link.startsWith('http') ? link : `https://${link}`;

            const releaseAttachment = new AttachmentBuilder(path.join(__dirname, 'release.png'), { name: 'release.png' });

            const embed = new EmbedBuilder()
                .setDescription(
                    `<:car:1479984910377812192> **Greenville Roleplay Mission** — **Session Released!** <:car:1479984910377812192>\n\n` +
                    `<:dasharrow:1480604353139179632> ${host} has now officially **released their roleplay session**. In order to join this roleplay session, you must click the button below. Prior to joining we ask that you read agree to every rule within <#1478874657481294017>, and your account privacy settings have to be set to __'everyone'__ allowing you to join the roleplay.\n\n\n` +
                    `<:dasharrow:1480604353139179632> **Session Informative:**\n` +
                    `<:curvedline:1480604557930397838> Fail-Roleplay Limit: **${frl}**\n` +
                    `<:curvedline:1480604557930397838> Peacetime Status: **${peacetime}**\n` +
                    `<:curvedline:1480604557930397838> Emergency Services: **${emergency}**`
                )
                .setColor(0xffffc5)
                .setImage('attachment://release.png')
                .setTimestamp();

            await interaction.channel.send({
                content: `<@&1478874601445396725>`,
                embeds: [embed],
                files: [releaseAttachment],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Link')
                            .setEmoji({ id: '1482744239518388260', name: 'link2' })
                            .setStyle(ButtonStyle.Link)
                            .setURL(safeLink)
                    )
                ]
            });

            await interaction.editReply({ content: 'Session release posted!', ephemeral: true });
        } catch (err) {
            console.error('Error in /release command:', err);
            await interaction.editReply({ content: `Something went wrong: ${err.message}`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'reinvites') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const link = interaction.options.getString('link');
        const frl = interaction.options.getString('frl');
        const peacetime = interaction.options.getString('peacetime');
        const emergency = interaction.options.getString('emergency');
        const host = interaction.user;

        await interaction.deferReply({ ephemeral: true });

        try {
            const safeLink = link.startsWith('http') ? link : `https://${link}`;

            const reinvitesAttachment = new AttachmentBuilder(path.join(__dirname, 'reinvites.png'), { name: 'reinvites.png' });

            const embed = new EmbedBuilder()
                .setDescription(
                    `<:car:1479984910377812192> Greenville Roleplay Mission — Session Re-invites! <:car:1479984910377812192>\n\n` +
                    `<:dasharrow:1480604353139179632> ${host} has now released their **roleplay session re-invites**. In order to join this roleplay session, you must click the button below. Prior to joining we ask that you read agree to every rule within <#1478874657481294017>, and your account privacy settings have to be set to __'everyone'__ allowing you to join the roleplay.\n\n\n` +
                    `<:dasharrow:1480604353139179632> **Session Informative:**\n` +
                    `<:curvedline:1480604557930397838> Fail-Roleplay Limit: **${frl}**\n` +
                    `<:curvedline:1480604557930397838> Peacetime Status: **${peacetime}**\n` +
                    `<:curvedline:1480604557930397838> Emergency Services: **${emergency}**`
                )
                .setColor(0xffffc5)
                .setImage('attachment://reinvites.png')
                .setTimestamp();

            await interaction.channel.send({
                content: `<@&1478874601445396725>`,
                embeds: [embed],
                files: [reinvitesAttachment],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Link')
                            .setEmoji({ id: '1482744239518388260', name: 'link2' })
                            .setStyle(ButtonStyle.Link)
                            .setURL(safeLink)
                    )
                ]
            });

            await interaction.editReply({ content: 'Session re-invites posted!', ephemeral: true });
        } catch (err) {
            console.error('Error in /reinvites command:', err);
            await interaction.editReply({ content: `Something went wrong: ${err.message}`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'embed') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const statement = interaction.options.getString('statement');
        const imageUrl = interaction.options.getString('image');

        await interaction.deferReply({ ephemeral: true });

        try {
            const embeds = [];

            if (imageUrl) {
                const imageEmbed = new EmbedBuilder()
                    .setColor(0xffffc5)
                    .setImage(imageUrl);

                embeds.push(imageEmbed);
            }

            const statementEmbed = new EmbedBuilder()
                .setDescription(statement)
                .setColor(0xffffc5);

            embeds.push(statementEmbed);

            await interaction.channel.send({ embeds });

            await interaction.editReply({ content: 'Embed posted!', ephemeral: true });
        } catch (err) {
            console.error('Error in /embed command:', err);
            await interaction.editReply({ content: `Something went wrong: ${err.message}`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'ticketpanel') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const panelAttachment = new AttachmentBuilder(path.join(__dirname, 'ticketsupport.png'), { name: 'ticketsupport.png' });

            const panelEmbed = new EmbedBuilder()
                .setDescription(
                    `<:car:1479984910377812192> **Greenville Roleplay Mission — Assistance** <:car:1479984910377812192>\n\n` +
                    `<:car:1480604475910783016><:dasharrow:1480604353139179632> Welcome to the **Greenville Roleplay Mission** assistance center! Within this channel you may create a support ticket if you require assistance allowing all of your questions to be answered by one of our staff member within a short amount of time depending on the severity. — If you decide to abuse this system you will be punished, additionally if you do not respond within 24 hour(s) the ticket will simply be closed.\n\n` +
                    `<:curvedline:1480604557930397838> 1. **General Support**: They are used if you have general questions that you would like to be answered. Additionally you may request a partnership with our community, or appeal your Infraction/Staff Strike.\n\n` +
                    `<:curvedline:1480604557930397838> 2. **Member Report**: You must only create these if you want to report a staff member or civilian, however you must have valid evidence with a good reason for your report to make sure the member you are reporting is dealt with accordingly. Opening a petty report may result in a punishment.`
                )
                .setColor(0xffffc5)
                .setImage('attachment://ticketsupport.png');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_type')
                .setPlaceholder('Select a ticket type...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('General Support')
                        .setDescription('General questions, partnerships, or infraction appeals.')
                        .setValue('general'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Member Report')
                        .setDescription('Report a staff member or civilian with evidence.')
                        .setValue('report')
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.channel.send({
                embeds: [panelEmbed],
                files: [panelAttachment],
                components: [row]
            });

            await interaction.editReply({ content: 'Ticket panel posted!', ephemeral: true });
        } catch (err) {
            console.error('Error in /ticketpanel command:', err);
            await interaction.editReply({ content: `Something went wrong: ${err.message}`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'regen') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const embed = new EmbedBuilder()
                .setDescription(
                    `<:car:1479984910377812192> **Greenville Roleplay Mission** — **Link Regenerated!** <:car:1479984910377812192>\n\n` +
                    `<:dasharrow:1480604353139179632> **This message is being sent due to this Greenville Roleplay Mission** roleplay session officially being closed and locked. You are now required to wait for the host to announce reinvites, if there is enough space within the session. — You may not ping the host for reinvites as it will result in a sanction if you do.`
                )
                .setColor(0xffffc5)
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed] });
            await interaction.editReply({ content: 'Regen message posted!', ephemeral: true });
        } catch (err) {
            console.error('Error in /regen command:', err);
            await interaction.editReply({ content: `Something went wrong: ${err.message}`, ephemeral: true });
        }
    }
});

// ── Reaction Tracking ─────────────────────────────────────────────────────────

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }

    const data = startupMessages.get(reaction.message.id);
    if (!data || data.triggered) return;

    if (reaction.emoji.toString() !== '<:checkmark:1480604103645331467>') return;

    const nonBotCount = reaction.count - 1;
    if (nonBotCount >= data.required) {
        data.triggered = true;

        const prepAttachment = new AttachmentBuilder(path.join(__dirname, 'settingup.png'), { name: 'settingup.png' });

        const embed = new EmbedBuilder()
            .setDescription(
                `**Greenville Roleplay Mission** — **Session Preparation**\n\n` +
                `<:curvedline:1480604557930397838> The **reactions** needed for this session **to commence** has **met**! Please give the host **5–10** minutes to ensure this **session** goes smoothly.`
            )
            .setColor(0xffffc5)
            .setImage('attachment://settingup.png');

        await reaction.message.reply({ embeds: [embed], files: [prepAttachment] });
    }
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});

client.login(TOKEN);
