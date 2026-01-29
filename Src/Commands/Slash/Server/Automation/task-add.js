const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'schedule-task-add',
    description: 'Append a new operational task to an automation sequence.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('schedule-task-add')
        .setDescription('Append a new operational task to an automation sequence.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('schedule').setDescription('Schedule ID').setRequired(true))
        .addStringOption(opt => opt.setName('action').setDescription('Action to perform').setRequired(true)
            .addChoices(
                { name: 'Send Console Command', value: 'command' },
                { name: 'Power Action', value: 'power' },
                { name: 'Create Backup', value: 'backup' }
            ))
        .addStringOption(opt => opt.setName('payload').setDescription('Command string / Power signal / Ignored files').setRequired(true))
        .addIntegerOption(opt => opt.setName('offset').setDescription('Time offset in seconds from start (default: 0)').setRequired(false))
        .addBooleanOption(opt => opt.setName('continue').setDescription('Continue on failure (default: true)').setRequired(false)),

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
            const action = interaction.options.getString('action');
            const payload = interaction.options.getString('payload');
            const timeOffset = interaction.options.getInteger('offset') || 0;
            const continueOnFailure = interaction.options.getBoolean('continue') ?? true;

            const taskData = {
                action,
                payload,
                time_offset: timeOffset,
                continue_on_failure: continueOnFailure
            };

            const task = await ptero.createScheduleTask(panel.url, panel.apikey, serverId, scheduleId, taskData);

            const embed = createSuccessEmbed(
                'Automation Task Appended',
                `A new ${action.toUpperCase()} task has been added to schedule \`${scheduleId}\` on server \`${serverId}\`.`,
                [
                    { name: '⚡ Action', value: action, inline: true },
                    { name: '⏱️ Offset', value: `${timeOffset}s`, inline: true },
                    { name: '🆔 Task ID', value: `\`${task.id}\``, inline: true },
                    { name: '📋 Payload', value: `\`${payload}\``, inline: false }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Task Logic', 'append schedule task', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
