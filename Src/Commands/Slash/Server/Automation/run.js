const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'run-schedule',
    description: 'Manually trigger an existing automation schedule.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('run-schedule')
        .setDescription('Manually trigger an existing automation schedule.')
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

            await ptero.executeSchedule(panel.url, panel.apikey, serverId, scheduleId);

            const embed = createSuccessEmbed(
                'Automation Triggered',
                `Schedule \`${scheduleId}\` has been queued for immediate execution on instance \`${serverId}\`.`,
                [
                    { name: '⚡ Action', value: 'Force Run', inline: true },
                    { name: '🌐 Panel', value: panel.name, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Manual Trigger', 'execute schedule', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
