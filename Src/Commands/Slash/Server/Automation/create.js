const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'create-schedule',
    description: 'Initialize a new automation timeline.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('create-schedule')
        .setDescription('Initialize a new automation timeline.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('name').setDescription('Schedule Name').setRequired(true))
        .addIntegerOption(opt => opt.setName('minute').setDescription('Minute (0-59)').setRequired(true))
        .addIntegerOption(opt => opt.setName('hour').setDescription('Hour (0-23)').setRequired(true))
        .addStringOption(opt => opt.setName('day_of_week').setDescription('Day of Week (0-6 or *)').setRequired(false))
        .addStringOption(opt => opt.setName('day_of_month').setDescription('Day of Month (1-31 or *)').setRequired(false))
        .addBooleanOption(opt => opt.setName('active').setDescription('Set active on create').setRequired(false)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resolved = await pteroUtils.resolveServer(interaction);
            if (!resolved) {
                return interaction.editReply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
            }

            const { panel, serverId } = resolved;
            const name = interaction.options.getString('name');
            const minute = interaction.options.getInteger('minute').toString();
            const hour = interaction.options.getInteger('hour').toString();
            const dayOfWeek = interaction.options.getString('day_of_week') || '*';
            const dayOfMonth = interaction.options.getString('day_of_month') || '*';
            const isActive = interaction.options.getBoolean('active') ?? true;

            const scheduleData = {
                name,
                minute,
                hour,
                day_of_week: dayOfWeek,
                day_of_month: dayOfMonth,
                is_active: isActive
            };

            const schedule = await ptero.createSchedule(panel.url, panel.apikey, serverId, scheduleData);

            const embed = createSuccessEmbed(
                'Automation Schedule Created',
                `New schedule \`${name}\` established for server \`${serverId}\`.`,
                [
                    { name: '⏰ Cron Trigger', value: `\`${minute} ${hour} ${dayOfMonth} * ${dayOfWeek}\``, inline: true },
                    { name: '⚡ Status', value: isActive ? '🟢 Active' : '⏸️ Paused', inline: true },
                    { name: '🆔 Schedule ID', value: `\`${schedule.id}\``, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Automation Config', 'create new schedule', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
