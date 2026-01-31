const { SlashCommandSubcommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');

module.exports = {
    name: 'get',
    description: 'Get your account details',
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

            if (!panel) {
                return await interaction.editReply({
                    content: '❌ No active panels found. Use `/panel toggle` to enable a panel.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Fetch account details
            const account = await ptero.getAccountDetails(panel.url, panel.apikey);

            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('👤 Account Details')
                .setDescription(`Account information from **${panel.name}**`)
                .addFields(
                    { name: '📧 Email', value: account.email, inline: true },
                    { name: '👤 Username', value: account.username, inline: true },
                    { name: '🆔 UUID', value: `\`${account.uuid}\``, inline: false },
                    { name: '🔐 Admin', value: account.admin ? '✅ Yes' : '❌ No', inline: true },
                    { name: '🔒 2FA', value: account['2fa'] ? '✅ Enabled' : '❌ Disabled', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Panel: ${panel.name}` });

            await interaction.editReply({
                embeds: [embed],
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[ACCOUNT GET] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Fetching Account Details**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
