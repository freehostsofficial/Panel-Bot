const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'delete-schedule',
    description: 'Remove an automation timeline from the registry.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('delete-schedule')
        .setDescription('Remove an automation timeline from the registry.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('schedule').setDescription('Schedule ID').setRequired(true)),

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

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🗑️ Schedule Deletion Requested')
            .setDescription(`You are about to delete schedule ID \`${scheduleId}\` from instance \`${serverId}\`.`)
            .addFields(
                { name: '⚠️ Warning', value: 'This action is **irreversible**. All associated tasks will be removed.', inline: false }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_sched_delete')
                .setLabel('Confirm Deletion')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('cancel_sched_delete')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_sched_delete') {
                await i.deferUpdate();
                try {
                    await ptero.deleteSchedule(panel.url, panel.apikey, serverId, scheduleId);

                    const successEmbed = createSuccessEmbed(
                        'Schedule Deleted',
                        `Automation schedule \`${scheduleId}\` has been removed from the registry.`
                    );

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    const error = handleApiError(err, 'Schedule Deletion', 'remove automation timeline');
                    await interaction.editReply({ embeds: [error], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Deletion Aborted.** Schedule remains active.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
