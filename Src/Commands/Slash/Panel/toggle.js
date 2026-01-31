const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../Functions/database');
const pteroUtils = require('../../../Functions/pteroUtils');

module.exports = {
    name: 'toggle',
    description: 'Enable or disable a panel',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Panel to toggle')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addBooleanOption(option =>
            option
                .setName('active')
                .setDescription('Enable (true) or disable (false) the panel')
                .setRequired(true)
        ),

    async autocomplete(interaction) {
        await pteroUtils.panelAutocomplete(interaction);
    },

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const name = interaction.options.getString('name');
            const active = interaction.options.getBoolean('active');
            const userId = interaction.user.id;

            // Check for invalid autocomplete values
            if (['no_panels', 'no_match', 'error'].includes(name)) {
                return await interaction.editReply({
                    content: '❌ No panel selected. Please try the command again.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Check if panel exists
            const panel = await db.getPanelByName(userId, name);
            if (!panel) {
                return await interaction.editReply({
                    content: `❌ Panel **${name}** not found.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Check if already in the desired state
            const currentlyActive = panel.active !== false;
            if (currentlyActive === active) {
                const stateText = active ? 'already active' : 'already disabled';
                return await interaction.editReply({
                    content: `ℹ️ Panel **${name}** is ${stateText}.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Update active status
            await db.updatePanel(userId, name, { active });

            // Clear server cache for this user
            try {
                const { default: pteroUtilsCache } = require('../../../Functions/pteroUtils');
                if (pteroUtilsCache && pteroUtilsCache.clearUserCache) {
                    pteroUtilsCache.clearUserCache(userId);
                }
            } catch (err) {
                // Cache clear failed, not critical
            }

            const statusIcon = active ? '✅' : '❌';
            const statusText = active ? 'Enabled' : 'Disabled';
            const statusDescription = active
                ? 'The panel is now active and will appear in server autocomplete.'
                : 'The panel is now disabled and will not appear in server autocomplete.';

            const successMessage = [
                `${statusIcon} **Panel ${statusText}**`,
                '━━━━━━━━━━━━━━━━',
                `**Panel:** ${name}`,
                `**Status:** ${statusText}`,
                '',
                statusDescription
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[PANEL TOGGLE] Error:', error);

            await interaction.editReply({
                content: `❌ An error occurred while toggling the panel: ${error.message}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
