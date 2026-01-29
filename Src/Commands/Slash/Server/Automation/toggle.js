const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'schedule-toggle',
    description: 'Enable or disable an automation schedule.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('schedule-toggle')
        .setDescription('Enable or disable an automation schedule.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('schedule').setDescription('Schedule ID').setRequired(true)),

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
            const scheduleId = interaction.options.getInteger('schedule');

            const schedule = await ptero.getSchedule(panel.url, panel.apikey, serverId, scheduleId);
            const newState = !schedule.is_active;

            await ptero.updateSchedule(panel.url, panel.apikey, serverId, scheduleId, {
                is_active: newState,
                name: schedule.name,
                minute: schedule.cron.minute,
                hour: schedule.cron.hour,
                day_of_month: schedule.cron.day_of_month,
                day_of_week: schedule.cron.day_of_week
            });

            const embed = createSuccessEmbed(
                'Automation State Updated',
                `Schedule \`${schedule.name}\` has been **${newState ? 'ENABLED' : 'DISABLED'}**.`,
                [
                    { name: '⚡ New Status', value: newState ? '🟢 Active' : '⏸️ Paused', inline: true },
                    { name: '🆔 Schedule ID', value: `\`${scheduleId}\``, inline: true },
                    { name: '🌐 Panel', value: panel.name, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Automation State', 'toggle schedule status', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
