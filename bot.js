const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Error registering commands:', error);
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
    if (interaction.isButton()) {
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
                        .setURL(link)
                )
            ]
        });

        await interaction.editReply({ content: 'Session release posted!', ephemeral: true });
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
