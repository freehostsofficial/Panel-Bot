const { SlashCommandSubcommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'disable',
    description: 'Disable Two-Factor Authentication',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('password')
                .setDescription('Your account password')
                .setRequired(true)
        ),



    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const password = interaction.options.getString('password');
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
                        .setCustomId('2fa_disable_confirm')
                        .setLabel('✅ Confirm Disable 2FA')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('2fa_disable_cancel')
                        .setLabel('❌ Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

            const confirmMessage = [
                '⚠️ **Confirm Disable Two-Factor Authentication**',
                '',
                'You are about to **disable 2FA** on your account.',
                '',
                '**This will make your account less secure.**',
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

                if (buttonInteraction.customId === '2fa_disable_cancel') {
                    await buttonInteraction.update({
                        content: '❌ 2FA disable cancelled. Your account remains protected.',
                        components: [],
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                // Disable 2FA
                await buttonInteraction.deferUpdate();
                await ptero.disable2fa(panel.url, panel.apikey, password);

                await buttonInteraction.editReply({
                    content: '✅ **Two-Factor Authentication Disabled**\n\nYour account is no longer protected by 2FA. Consider re-enabling it for better security.',
                    components: [],
                    flags: [MessageFlags.Ephemeral]
                });

            } catch (error) {
                if (error.message && error.message.includes('time')) {
                    // Timeout
                    await interaction.editReply({
                        content: '⏱️ Confirmation timeout. 2FA disable cancelled.',
                        components: [],
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => { });
                } else {
                    throw error;
                }
            }

        } catch (error) {
            console.error('[2FA DISABLE] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Disabling 2FA**\n\n${errorMessage}`,
                components: [],
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
