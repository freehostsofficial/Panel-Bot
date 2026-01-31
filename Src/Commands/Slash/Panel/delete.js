const { SlashCommandSubcommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../Functions/database');
const pteroUtils = require('../../../Functions/pteroUtils');

module.exports = {
    name: 'delete',
    description: 'Remove a Pterodactyl panel from your account',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Panel to delete')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        await pteroUtils.panelAutocomplete(interaction);
    },

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const name = interaction.options.getString('name');
            const userId = interaction.user.id;

            // Check for invalid autocomplete values
            if (['no_panels', 'no_match', 'error'].includes(name)) {
                return await interaction.editReply({
                    content: '❌ No panel selected. Please try the command again.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Verify panel exists
            const panel = await db.getPanelByName(userId, name);
            if (!panel) {
                return await interaction.editReply({
                    content: `❌ Panel **${name}** not found. Use \`/panel list\` to see your panels.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Create confirmation buttons
            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`panel_delete_confirm_${name}`)
                        .setLabel('✅ Confirm Delete')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('panel_delete_cancel')
                        .setLabel('❌ Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

            const confirmMessage = [
                '⚠️ **Confirm Panel Deletion**',
                '',
                `You are about to delete panel: **${name}**`,
                `URL: \`${panel.url}\``,
                '',
                '**This action cannot be undone.**',
                '',
                'Please confirm by clicking the button below:'
            ].join('\n');

            const response = await interaction.editReply({
                content: confirmMessage,
                components: [confirmRow],
                flags: [MessageFlags.Ephemeral]
            });

            // Wait for button interaction
            try {
                const buttonInteraction = await response.awaitMessageComponent({
                    filter: i => i.user.id === userId,
                    time: 30000 // 30 seconds
                });

                if (buttonInteraction.customId === 'panel_delete_cancel') {
                    await buttonInteraction.update({
                        content: '❌ Panel deletion cancelled.',
                        components: [],
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                // Delete the panel
                const deleted = await db.removePanel(userId, name);

                if (deleted) {
                    await buttonInteraction.update({
                        content: `✅ **Panel Deleted**\n\nPanel **${name}** has been removed from your account.`,
                        components: [],
                        flags: [MessageFlags.Ephemeral]
                    });
                } else {
                    await buttonInteraction.update({
                        content: `❌ Failed to delete panel **${name}**. It may have already been removed.`,
                        components: [],
                        flags: [MessageFlags.Ephemeral]
                    });
                }
            } catch (error) {
                // Timeout - no button clicked
                await interaction.editReply({
                    content: '⏱️ Confirmation timeout. Panel deletion cancelled.',
                    components: [],
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => { });
            }

        } catch (error) {
            console.error('[PANEL DELETE] Error:', error);

            await interaction.editReply({
                content: `❌ An error occurred while deleting the panel: ${error.message}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
