const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'update',
    description: 'Update your account email address',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('new_email')
                .setDescription('New email address')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('password')
                .setDescription('Your current password')
                .setRequired(true)
        ),



    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const newEmail = interaction.options.getString('new_email').trim();
            const password = interaction.options.getString('password');
            const userId = interaction.user.id;

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                return await interaction.editReply({
                    content: '❌ Invalid email format. Please enter a valid email address.',
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

            // Update email
            await ptero.updateEmail(panel.url, panel.apikey, newEmail, password);

            const successMessage = [
                '✅ **Email Updated Successfully!**',
                '━━━━━━━━━━━━━━━━',
                `**New Email:** ${newEmail}`,
                '',
                '📧 A confirmation email has been sent to your new address.',
                'Please verify your email to complete the update.'
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[EMAIL UPDATE] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Updating Email**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
