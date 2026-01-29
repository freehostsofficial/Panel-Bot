const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'schedule-task-delete',
    description: 'Remove a specific task from an automation sequence.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('schedule-task-delete')
        .setDescription('Remove a specific task from an automation sequence.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('schedule').setDescription('Schedule ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('task').setDescription('Task ID').setRequired(true)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        const resolved = await pteroUtils.resolveServer(interaction);
        if (!resolved) {
            return interaction.reply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
        }

        const { panel, serverId } = resolved;
        const scheduleId = interaction.options.getInteger('schedule');
        const taskId = interaction.options.getInteger('task');

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🗑️ Task Deletion Requested')
            .setDescription(`You are about to remove task ID \`${taskId}\` from schedule \`${scheduleId}\` on instance \`${serverId}\`.`)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_task_delete')
                .setLabel('Confirm Deletion')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('cancel_task_delete')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_task_delete') {
                await i.deferUpdate();
                try {
                    await ptero.deleteScheduleTask(panel.url, panel.apikey, serverId, scheduleId, taskId);

                    const successEmbed = createSuccessEmbed(
                        'Task Removed',
                        `Logic step \`${taskId}\` has been successfully purged from schedule \`${scheduleId}\`.`
                    );

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    const error = handleApiError(err, 'Task Logic', 'remove logic step');
                    await interaction.editReply({ embeds: [error], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Deletion Aborted.** Task remains in sequence.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
