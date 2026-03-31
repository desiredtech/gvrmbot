const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) throw new Error('DISCORD_TOKEN environment variable is not set.');

const EA_CHANNEL_ID = '1478874724665659664';
const EA_ACCESS_ROLES = ['1478874545715679486', '1478874597901467720', '1478874602997289002'];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

const startupMessages = new Map();
const eaLinks = new Map();

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

        const channel = await interaction.guild.channels.fetch(EA_CHANNEL_ID).catch(() => null);
        if (!channel?.isTextBased()) {
            return interaction.editReply({ content: 'Early access channel not found.', ephemeral: true });
        }

        const eaAttachment = new AttachmentBuilder(path.join(__dirname, 'ea.png'), { name: 'ea.png' });

        const embed = new EmbedBuilder()
            .setDescription(
                `<:car:1479984910377812192>  **Greenville Roleplay Mission** — **Early Access!** <:car:1479984910377812192>\n\n` +
                `<:curvedline:1480604557930397838> ${host} has released early access for their roleplay session. If you have access to the button below, you may begin joining now before the session link is closed. Once you're in-game, please park your vehicle and wait for further instructions from staff.`
            )
            .setColor(0xffffc5)
            .setImage('attachment://ea.png')
            .setTimestamp();

        const message = await channel.send({
            content: `<@&1478874545715679486> <@&1478874597901467720> <@&1478874602997289002>`,
            embeds: [embed],
            files: [eaAttachment],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ea_link:placeholder`)
                        .setLabel('Link')
                        .setEmoji({ id: '1482744239518388260', name: 'link2' })
                        .setStyle(ButtonStyle.Primary)
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
                        .setStyle(ButtonStyle.Primary)
                )
            ]
        });

        await interaction.editReply({ content: 'Early access posted!', ephemeral: true });
    }
});

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
