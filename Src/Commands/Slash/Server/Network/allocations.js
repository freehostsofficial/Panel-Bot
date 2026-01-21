const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { createPaginatedEmbed, chunkArray } = require('../../../../Functions/pagination');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: "allocations",
    description: "Audit the network topology and ingress allocations.",
    category: "Server",
    data: new SlashCommandBuilder()
        .setName("allocations")
        .setDescription("Audit the network topology and ingress allocations.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resolved = await pteroUtils.resolveServer(interaction);
            if (!resolved) return interaction.editReply({ content: "❌ Server not found or panel connection failed.", ephemeral: true });

            const { panel, serverId } = resolved;
            const allocations = await ptero.listAllocations(panel.url, panel.apikey, serverId);

            if (allocations.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle('🌐 Connectivity Scan: No Data')
                    .setDescription(`No network routes found for server \`${serverId}\` on **${panel.name}**.`)
                    .setTimestamp();
                return interaction.editReply({ embeds: [emptyEmbed] });
            }

            const chunked = chunkArray(allocations, 10);
            const embeds = chunked.map((chunk, index) => {
                const embed = new EmbedBuilder()
                    .setColor('#00d4ff')
                    .setTitle(`🌐 Node Routes: ${serverId}`)
                    .setDescription(`Identified **${allocations.length}** active network endpoints on **${panel.name}**.`)
                    .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Panel: ${panel.name}` })
                    .setTimestamp();

                chunk.forEach(a => {
                    const attr = a.attributes;
                    const isDefault = attr.is_default;
                    const statusIcon = isDefault ? '⭐' : '🔹';
                    const label = isDefault ? 'Primary' : 'Additional';

                    embed.addFields({
                        name: `${statusIcon} ${attr.ip}:${attr.port}`,
                        value: `\`\`\`yml\nRoute: ${label}\nAlias: ${attr.alias || 'None'}\nNote: ${attr.notes || 'N/A'}\nID: ${attr.id}\n\`\`\``,
                        inline: true
                    });
                });

                return embed;
            });

            await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Network Toplogy', 'scan allocations', { serverId: interaction.options.getString("id") });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
