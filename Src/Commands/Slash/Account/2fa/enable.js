const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'enable',
    description: 'Enable Two-Factor Authentication',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('code')
                .setDescription('6-digit code from your authenticator app')
                .setRequired(true)
        ),

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const code = interaction.options.getString('code').trim();
            const userId = interaction.user.id;

            // Validate code format
            if (!/^\d{6}$/.test(code)) {
                return await interaction.editReply({
                    content: '❌ Invalid code format. Please enter a 6-digit code from your authenticator app.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const userData = await db.getUserData(userId);

            if (!userData || !userData.panels || userData.panels.length === 0) {
                return await interaction.editReply({
                    content: '❌ No panels configured. Use `/panel add` to link a panel first.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Get first active panel
            const panel = userData.panels.find(p => p.active !== false) || userData.panels[0];

            // Enable 2FA
            const result = await ptero.enable2fa(panel.url, panel.apikey, code);

            const successMessage = [
                '✅ **Two-Factor Authentication Enabled!**',
                '━━━━━━━━━━━━━━━━',
                '',
                '🔐 Your account is now secured with 2FA.',
                '',
                '**Recovery Tokens:**',
                'Save these tokens in a safe place. You can use them to access your account if you lose your authenticator device.',
                '',
                ...(result.tokens || []).map(token => `\`${token}\``),
                '',
                '⚠️ **IMPORTANT:** Store these recovery tokens securely. They won\'t be shown again!'
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[2FA ENABLE] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Enabling 2FA**\n\n${errorMessage}\n\nMake sure you've run \`/account 2fa get-qr\` first and are using the correct code.`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
