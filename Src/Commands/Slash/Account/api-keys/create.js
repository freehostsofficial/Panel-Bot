const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'create',
    description: 'Create a new API key',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Description for the API key')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('allowed_ips')
                .setDescription('Comma-separated list of allowed IPs (optional)')
                .setRequired(false)
        ),

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const description = interaction.options.getString('description');
            const allowedIpsStr = interaction.options.getString('allowed_ips');
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

            // Parse allowed IPs
            const allowedIps = allowedIpsStr
                ? allowedIpsStr.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
                : [];

            // Create API key
            const newKey = await ptero.createApiKey(panel.url, panel.apikey, description, allowedIps);

            const successMessage = [
                '✅ **API Key Created Successfully!**',
                '━━━━━━━━━━━━━━━━',
                `**Description:** ${newKey.description}`,
                `**Identifier:** \`${newKey.identifier}\``,
                `**Token:** ||${newKey.token}||`,
                '',
                allowedIps.length > 0
                    ? `**Allowed IPs:** ${allowedIps.join(', ')}`
                    : '**Allowed IPs:** Any IP',
                '',
                '⚠️ **IMPORTANT:** Save this token now! You won\'t be able to see it again.',
                '',
                '📝 Use this token for API requests to your Pterodactyl panel.'
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[API-KEYS CREATE] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Creating API Key**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
