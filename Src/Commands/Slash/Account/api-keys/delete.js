const { SlashCommandSubcommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'delete',
    description: 'Delete an API key',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('identifier')
                .setDescription('API key identifier to delete')
                .setRequired(true)
        ),

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const identifier = interaction.options.getString('identifier');
            const userId = interaction.user.id;

            const userData = await db.getUserData(userId);

            if (!userData || !userData.panels || userData.panels.length === 0) {
                return await interaction.editReply({
                    content: '❌ No panels configured. Use `/panel add` to link a panel first.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Get first active panel
            const panel = userData.panels.find(p => p.active !== false) || userData.panels[0];

            // Create confirmation buttons
            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`apikey_delete_confirm_${identifier}`)
                        .setLabel('✅ Confirm Delete')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('apikey_delete_cancel')
                        .setLabel('❌ Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

            const confirmMessage = [
                '⚠️ **Confirm API Key Deletion**',
                '',
                `You are about to delete API key: \`${identifier}\``,
                '',
                '**This action cannot be undone.**',
                'Any applications using this key will lose access.',
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

                if (buttonInteraction.customId === 'apikey_delete_cancel') {
                    await buttonInteraction.update({
                        content: '❌ API key deletion cancelled.',
                        components: [],
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                // Delete the API key
                await ptero.deleteApiKey(panel.url, panel.apikey, identifier);

                await buttonInteraction.update({
                    content: `✅ **API Key Deleted**\n\nAPI key \`${identifier}\` has been permanently deleted.`,
                    components: [],
                    flags: [MessageFlags.Ephemeral]
                });

            } catch (error) {
                // Timeout - no button clicked
                await interaction.editReply({
                    content: '⏱️ Confirmation timeout. API key deletion cancelled.',
                    components: [],
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => { });
            }

        } catch (error) {
            console.error('[API-KEYS DELETE] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Deleting API Key**\n\n${errorMessage}`,
                components: [],
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
