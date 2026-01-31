const { SlashCommandSubcommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'get-qr',
    description: 'Get QR code for Two-Factor Authentication setup',
    data: new SlashCommandSubcommandBuilder(),

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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

            // Get 2FA details
            const twoFaData = await ptero.get2faDetails(panel.url, panel.apikey);

            const message = [
                '🔐 **Two-Factor Authentication Setup**',
                '━━━━━━━━━━━━━━━━',
                '',
                '**Step 1:** Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)',
                '',
                '**Step 2:** Enter the 6-digit code from your app using `/account 2fa enable <code>`',
                '',
                '**Manual Entry:**',
                `Secret: ||${twoFaData.secret}||`,
                '',
                `**QR Code:** ${twoFaData.image_url_data}`
            ].join('\n');

            await interaction.editReply({
                content: message,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[2FA GET-QR] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Getting 2FA QR Code**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
