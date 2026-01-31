const { SlashCommandSubcommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: 'list',
    description: 'List all your API keys',
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

            // Fetch API keys
            const apiKeys = await ptero.getApiKeys(panel.url, panel.apikey);

            if (!apiKeys || apiKeys.length === 0) {
                return await interaction.editReply({
                    content: '📋 **No API Keys**\n\nYou haven\'t created any API keys yet. Use `/account api-keys create` to make one.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('🔑 Your API Keys')
                .setDescription(`API keys from **${panel.name}**`)
                .setTimestamp()
                .setFooter({ text: `Total: ${apiKeys.length} key${apiKeys.length !== 1 ? 's' : ''}` });

            for (const key of apiKeys.slice(0, 25)) {
                const attrs = key.attributes;
                const createdAt = new Date(attrs.created_at).toLocaleDateString();
                const lastUsed = attrs.last_used_at
                    ? new Date(attrs.last_used_at).toLocaleDateString()
                    : 'Never';

                const allowedIps = attrs.allowed_ips && attrs.allowed_ips.length > 0
                    ? attrs.allowed_ips.join(', ')
                    : 'Any IP';

                const fieldValue = [
                    `**ID:** \`${attrs.identifier}\``,
                    `**Created:** ${createdAt}`,
                    `**Last Used:** ${lastUsed}`,
                    `**Allowed IPs:** ${allowedIps}`
                ].join('\n');

                embed.addFields({
                    name: attrs.description || 'Unnamed Key',
                    value: fieldValue,
                    inline: false
                });
            }

            if (apiKeys.length > 25) {
                embed.setDescription(`${embed.data.description}\n\n⚠️ Showing first 25 of ${apiKeys.length} keys`);
            }

            await interaction.editReply({
                embeds: [embed],
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[API-KEYS LIST] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Fetching API Keys**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
