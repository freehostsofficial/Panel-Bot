const { SlashCommandSubcommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');

module.exports = {
    name: 'list',
    description: 'View all your Pterodactyl panels',
    data: new SlashCommandSubcommandBuilder(),



    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const userId = interaction.user.id;
            const panels = await db.getPanels(userId);

            if (!panels || panels.length === 0) {
                return await interaction.editReply({
                    content: '📋 **No Panels Configured**\n\nYou haven\'t added any Pterodactyl panels yet. Use `/panel add` to get started!',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('📋 Your Pterodactyl Panels')
                .setDescription('All your configured panel connections')
                .setTimestamp();

            // Fetch server counts for each panel  
            for (const panel of panels) {
                const status = panel.active === false ? '❌ Disabled' : '✅ Active';
                let serverCount = '❓';

                if (panel.active !== false) {
                    try {
                        const servers = await ptero.listServers(panel.url, panel.apikey, true);
                        serverCount = `🖥️ ${servers.length} server${servers.length !== 1 ? 's' : ''}`;
                    } catch (error) {
                        serverCount = '⚠️ Error connecting';
                    }
                } else {
                    serverCount = '⏸️ Disabled';
                }

                const fieldValue = [
                    `**Status:** ${status}`,
                    `**URL:** ${panel.url}`,
                    `**Servers:** ${serverCount}`
                ].join('\n');

                embed.addFields({
                    name: panel.name,
                    value: fieldValue,
                    inline: false
                });
            }

            embed.setFooter({ text: `Total: ${panels.length} panel${panels.length !== 1 ? 's' : ''}` });

            await interaction.editReply({
                embeds: [embed],
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[PANEL LIST] Error:', error);

            await interaction.editReply({
                content: `❌ An error occurred while fetching panels: ${error.message}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
