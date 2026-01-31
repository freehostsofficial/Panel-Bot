const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'update',
    description: 'Update your account password',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('current_password')
                .setDescription('Your current password')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('new_password')
                .setDescription('Your new password')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('confirm_password')
                .setDescription('Confirm new password')
                .setRequired(true)
        ),



    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const currentPassword = interaction.options.getString('current_password');
            const newPassword = interaction.options.getString('new_password');
            const confirmPassword = interaction.options.getString('confirm_password');
            const userId = interaction.user.id;

            // Validate passwords match
            if (newPassword !== confirmPassword) {
                return await interaction.editReply({
                    content: '❌ New password and confirmation do not match. Please try again.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Validate password length
            if (newPassword.length < 8) {
                return await interaction.editReply({
                    content: '❌ Password must be at least 8 characters long.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Check if new password is same as current
            if (currentPassword === newPassword) {
                return await interaction.editReply({
                    content: '❌ New password must be different from current password.',
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

            // Update password
            await ptero.updatePassword(panel.url, panel.apikey, currentPassword, newPassword, confirmPassword);

            const successMessage = [
                '✅ **Password Updated Successfully!**',
                '━━━━━━━━━━━━━━━━',
                '',
                '🔐 Your account password has been changed.',
                '',
                '⚠️ **Important Security Notes:**',
                '• Use your new password for future logins',
                '• Consider updating your password manager',
                '• If you didn\'t make this change, contact support immediately'
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[PASSWORD UPDATE] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Updating Password**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
