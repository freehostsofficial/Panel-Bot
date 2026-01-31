const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../Functions/database');
const pteroUtils = require('../../../Functions/pteroUtils');

module.exports = {
    name: 'rename',
    description: 'Rename a panel',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('current_name')
                .setDescription('Current panel name')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('new_name')
                .setDescription('New panel name')
                .setRequired(true)
        ),

    async autocomplete(interaction) {
        await pteroUtils.panelAutocomplete(interaction);
    },

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const currentName = interaction.options.getString('current_name');
            const newName = interaction.options.getString('new_name').trim();
            const userId = interaction.user.id;

            // Check for invalid autocomplete values
            if (['no_panels', 'no_match', 'error'].includes(currentName)) {
                return await interaction.editReply({
                    content: '❌ No panel selected. Please try the command again.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Validate new name
            if (newName.length < 2 || newName.length > 32) {
                return await interaction.editReply({
                    content: '❌ Panel name must be between 2 and 32 characters.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Check if current panel exists
            const currentPanel = await db.getPanelByName(userId, currentName);
            if (!currentPanel) {
                return await interaction.editReply({
                    content: `❌ Panel **${currentName}** not found.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Check if new name is already in use
            const existingPanel = await db.getPanelByName(userId, newName);
            if (existingPanel && existingPanel.name.toLowerCase() !== currentName.toLowerCase()) {
                return await interaction.editReply({
                    content: `❌ A panel named **${newName}** already exists. Please choose a different name.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Perform rename by updating the panel
            await db.updatePanel(userId, currentName, { name: newName });

            // Clear server cache for this panel
            try {
                const { default: pteroUtilsCache } = require('../../../Functions/pteroUtils');
                if (pteroUtilsCache && pteroUtilsCache.clearUserCache) {
                    pteroUtilsCache.clearUserCache(userId);
                }
            } catch (err) {
                // Cache clear failed, not critical
            }

            const successMessage = [
                '✅ **Panel Renamed Successfully!**',
                '━━━━━━━━━━━━━━━━',
                `**Old Name:** ${currentName}`,
                `**New Name:** ${newName}`,
                '',
                '✨ Your panel has been renamed. Server autocomplete will now use the new name.'
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[PANEL RENAME] Error:', error);

            await interaction.editReply({
                content: `❌ An error occurred while renaming the panel: ${error.message}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
