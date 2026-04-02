const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActivityType,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) throw new Error('DISCORD_TOKEN environment variable is not set.');

const LOG_CHANNEL_ID = '1478874724665659664';
const EA_ACCESS_ROLES = ['1478874545715679486', '1478874597901467720', '1478874602997289002'];

const TICKET_CHANNEL_ID = '1478874696433795304';
const PARTNER_PING_CHANNEL_ID = '1478874659398090953';

const TICKET_SELECT_ID = 'gvrm_ticket_type_select';

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
const sessionStartTimes = new Map();
const openTickets = new Map();

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
        .setName('regen')
        .setDescription('Announce that the session link has been regenerated.')
        .toJSON(),

    new SlashCommandBuilder()
        .setName('over')
        .setDescription('Conclude the current GVRM roleplay session.')
        .toJSON(),

    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Post the ticket panel in the current channel.')
        .toJSON(),

    new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket channel.')
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    client.user.setActivity('Greenville Roleplay Mission', { type: ActivityType.Watching });

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log('Cleared global commands.');
    } catch (error) {
        console.error('Error clearing global commands:', error);
    }

    for (const guild of client.guilds.cache.values()) {
        try {
            console.log(`Registering slash commands for guild: ${guild.name}`);
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guild.id),
                { body: commands }
            );
            console.log(`Slash commands registered for guild: ${guild.name}`);
        } catch (error) {
            console.error(`Error registering commands for guild ${guild.name}:`, error);
        }
    }
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

// ── Partner Ping Channel Auto-Response ────────────────────────────────────────

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channelId !== PARTNER_PING_CHANNEL_ID) return;

    const embed = new EmbedBuilder()
        .setColor(0xffffc5)
        .setDescription(
            `<:dasharrow:1480604353139179632> ** Tired of the pings?**\n` +
            `Simply Mute this channel! right-click the channel name and select "Mute Channel," then choose the duration "Until I turn it back on". We are mass doing partners in Greenville Roleplay Mission. If you're interested, please open a ticket in the <#1478874696433795304> channel!`
        );

    try {
        await message.channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Failed to send partner ping response:', err);
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

    // ── Ticket Dropdown ───────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === TICKET_SELECT_ID) {
            const ticketType = interaction.values[0];
            await handleOpenTicket(interaction, ticketType);
            return;
        }
        return;
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            await handleCloseTicket(interaction);
            return;
        }

        if (interaction.customId.startsWith('ea_link:')) {
            const messageId = interaction.customId.split(':')[1];
            const link = eaLinks.get(messageId);

            const hasAccess = interaction.member.roles.cache.some(role => EA_ACCESS_ROLES.includes(role.id));
            if (!hasAccess) {
                return interaction.reply({ content: 'You do not have permission to access this link.', ephemeral: true });
            }

            return interaction.reply({ content: link ?? 'Link unavailable.', ephemeral: true });
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    // ── /membercount ──────────────────────────────────────────────────────────
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
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // ── /startup ──────────────────────────────────────────────────────────────
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

        const startupTimestamp = Math.floor(Date.now() / 1000);
        startupMessages.set(message.id, { required: reactions, triggered: false });
        sessionStartTimes.set(interaction.guildId, startupTimestamp);

        await interaction.editReply({ content: 'Session startup posted!', ephemeral: true });
    }

    // ── /ea ───────────────────────────────────────────────────────────────────
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

    // ── /release ──────────────────────────────────────────────────────────────
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

    // ── /regen ────────────────────────────────────────────────────────────────
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

    // ── /over ─────────────────────────────────────────────────────────────────
    if (interaction.commandName === 'over') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const host = interaction.user;
            const endTimestamp = Math.floor(Date.now() / 1000);
            const startTimestamp = sessionStartTimes.get(interaction.guildId);

            const startTimeText = startTimestamp
                ? `<t:${startTimestamp}:F>`
                : '*Session start time unavailable*';
            const endTimeText = `<t:${endTimestamp}:F>`;

            const concludedAttachment = new AttachmentBuilder(path.join(__dirname, 'concluded.png'), { name: 'concluded.png' });

            const embed = new EmbedBuilder()
                .setTitle('Greenville Roleplay Mission   — Session Conclusion!')
                .setDescription(
                    `<:dasharrow:1480604353139179632>${host} **has now concluded their roleplay session.** We appreciate those who have attended this roleplay however, we encourage you to visit the next one being hosted soon!\n\n` +
                    `<:curvedline:1480604557930397838>  **Want to report a user or got a question?** — head over to our <#1478874696433795304> and create an ticket, please ensure you have the required amount of proof before you open a ticket.\n\n` +
                    `<:dasharrow:1480604353139179632>Session Start Time: ${startTimeText}\n` +
                    `<:dasharrow:1480604353139179632>Session End Time: ${endTimeText}`
                )
                .setColor(0xffffc5)
                .setImage('attachment://concluded.png')
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed], files: [concludedAttachment] });

            sessionStartTimes.delete(interaction.guildId);

            await interaction.editReply({ content: 'Session conclusion posted!', ephemeral: true });
        } catch (err) {
            console.error('Error in /over command:', err);
            await interaction.editReply({ content: `Something went wrong: ${err.message}`, ephemeral: true });
        }
    }

    // ── /ticket ───────────────────────────────────────────────────────────────
    if (interaction.commandName === 'ticket') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('Greenville Roleplay Mission — Assistance')
            .setDescription(
                `<:car:1479984910377812192> ▸ Welcome to the **Greenville Roleplay Mission** assistance center! Within this channel you may create a support ticket if you require assistance allowing all of your questions to be answered by one of our staff member within a short amount of time depending on the severity. — If you decide to abuse this system you will be punished, additionally if you do not respond within 24 hour(s) the ticket will simply be closed.\n\n` +
                `<:curvedline:1480604557930397838> 1. **General Support**: They are used if you have general questions that you would like to be answered. Additionally you may request a partnership with our community, or appeal your Infraction/Staff Strike.\n\n` +
                `<:curvedline:1480604557930397838> 2. **Member Report**: You must only create these if you want to report a staff member or civilian, however you must have valid evidence with a good reason for your report to make sure the member you are reporting is dealt with accordingly. Opening a petty report may result in a punishment.`
            )
            .setColor(0xffffc5)
            .setImage('attachment://ticket.png')
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(TICKET_SELECT_ID)
            .setPlaceholder('Select a ticket type...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('General Support')
                    .setDescription('General questions, partnerships, or infraction appeals.')
                    .setValue('general_support'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Member Report')
                    .setDescription('Report a staff member or civilian with evidence.')
                    .setValue('member_report')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const ticketFile = path.join(__dirname, 'ticket.png');
        const fs = require('fs');

        const sendOptions = { embeds: [embed], components: [row] };
        if (fs.existsSync(ticketFile)) {
            sendOptions.files = [new AttachmentBuilder(ticketFile, { name: 'ticket.png' })];
        }

        await interaction.reply({ content: 'Ticket panel posted!', ephemeral: true });
        await interaction.channel.send(sendOptions);
    }

    // ── /close ────────────────────────────────────────────────────────────────
    if (interaction.commandName === 'close') {
        const hasStaffRole = interaction.member.roles.cache.some(role => role.name === 'Staff Team');

        if (!hasStaffRole) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await handleCloseTicket(interaction);
    }
});

// ── Ticket Handlers ───────────────────────────────────────────────────────────

async function handleOpenTicket(interaction, ticketType) {
    const guild = interaction.guild;
    const user = interaction.user;
    const ticketKey = `${guild.id}-${user.id}`;

    if (openTickets.has(ticketKey)) {
        const existingChannelId = openTickets.get(ticketKey);
        const existingChannel = guild.channels.cache.get(existingChannelId);
        if (existingChannel) {
            return interaction.reply({
                content: `You already have an open ticket: <#${existingChannelId}>. Please use that one or ask staff to close it.`,
                ephemeral: true
            });
        } else {
            openTickets.delete(ticketKey);
        }
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const ticketChannel = await guild.channels.fetch(TICKET_CHANNEL_ID).catch(() => null);
        const category = ticketChannel?.parentId ? guild.channels.cache.get(ticketChannel.parentId) : null;

        const staffRole = guild.roles.cache.find(r => r.name === 'Staff Team');

        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            },
            {
                id: client.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels
                ]
            }
        ];

        if (staffRole) {
            permissionOverwrites.push({
                id: staffRole.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ManageMessages
                ]
            });
        }

        const isReport = ticketType === 'member_report';
        const channelName = isReport
            ? `report-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`
            : `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

        const channelOptions = {
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites
        };

        if (category) channelOptions.parent = category.id;

        const newChannel = await guild.channels.create(channelOptions);

        openTickets.set(ticketKey, newChannel.id);

        const typeLabel = isReport ? 'Member Report' : 'General Support';
        const typeDescription = isReport
            ? `<:curvedline:1480604557930397838> Please provide the **username** of the member you are reporting, the **reason** for the report, and any **evidence** you have (screenshots, videos, etc.).\n\n<:curvedline:1480604557930397838> Note: Opening a petty report without valid evidence may result in a punishment.`
            : `<:curvedline:1480604557930397838> Please describe your question or issue in as much detail as possible. A staff member will be with you shortly.\n\n<:curvedline:1480604557930397838> If you do not respond within **24 hours**, this ticket will be closed.`;

        const embed = new EmbedBuilder()
            .setTitle(`Greenville Roleplay Mission — ${typeLabel}`)
            .setDescription(
                `<:dasharrow:1480604353139179632> Welcome, ${user}! A staff member will be with you shortly.\n\n` +
                typeDescription
            )
            .setColor(0xffffc5)
            .setTimestamp();

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
        );

        const mentionContent = `${user}${staffRole ? ` <@&${staffRole.id}>` : ''}`;
        await newChannel.send({ content: mentionContent, embeds: [embed], components: [closeRow] });

        const logEmbed = new EmbedBuilder()
            .setTitle('Ticket Opened')
            .setColor(0xffffc5)
            .addFields(
                { name: 'User', value: `${user} (${user.tag})`, inline: true },
                { name: 'Type', value: typeLabel, inline: true },
                { name: 'Channel', value: `<#${newChannel.id}>`, inline: true }
            )
            .setTimestamp();

        await sendLog(guild, logEmbed);

        await interaction.editReply({ content: `Your **${typeLabel}** ticket has been created: <#${newChannel.id}>`, ephemeral: true });
    } catch (err) {
        console.error('Error creating ticket:', err);
        await interaction.editReply({ content: `Something went wrong creating your ticket: ${err.message}`, ephemeral: true });
    }
}

async function handleCloseTicket(interaction) {
    const guild = interaction.guild;
    const channel = interaction.channel;

    const isTicket = channel.name.startsWith('ticket-') || channel.name.startsWith('report-');
    if (!isTicket) {
        return interaction.reply({ content: 'This command can only be used inside a ticket channel.', ephemeral: true });
    }

    const ticketKey = [...openTickets.entries()].find(([, id]) => id === channel.id)?.[0];

    await interaction.deferReply({ ephemeral: true });

    try {
        const closeEmbed = new EmbedBuilder()
            .setTitle('Greenville Roleplay Mission — Ticket Closing')
            .setDescription(
                `<:dasharrow:1480604353139179632> This ticket is now being **closed**. This channel will be deleted in **5 seconds**.\n\n` +
                `<:curvedline:1480604557930397838> Closed by ${interaction.user}`
            )
            .setColor(0xffffc5)
            .setTimestamp();

        await channel.send({ embeds: [closeEmbed] });

        const logEmbed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setColor(0xffffc5)
            .addFields(
                { name: 'Closed By', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                { name: 'Channel', value: `#${channel.name}`, inline: true }
            )
            .setTimestamp();

        await sendLog(guild, logEmbed);

        if (ticketKey) openTickets.delete(ticketKey);

        await interaction.editReply({ content: 'Ticket is being closed...', ephemeral: true });

        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.error('Failed to delete ticket channel:', err);
            }
        }, 5000);
    } catch (err) {
        console.error('Error closing ticket:', err);
        await interaction.editReply({ content: `Something went wrong: ${err.message}`, ephemeral: true });
    }
}

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
