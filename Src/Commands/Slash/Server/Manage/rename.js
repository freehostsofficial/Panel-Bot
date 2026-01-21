const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: "rename",
    description: "Rebrand the visual identity of the remote instance.",
    category: "Server",
    data: new SlashCommandBuilder()
        .setName("rename")
        .setDescription("Rebrand the visual identity of the remote instance.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("name").setDescription("New visual identity (name)").setRequired(true)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resolved = await pteroUtils.resolveServer(interaction);
            if (!resolved) return interaction.editReply({ content: "❌ Server not found or panel connection failed.", ephemeral: true });

            const { panel, serverId } = resolved;
            const newName = interaction.options.getString("name");

            await ptero.renameServer(panel.url, panel.apikey, serverId, newName);

            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('✏️ Identity Rebranded')
                .setDescription(`Server \`${serverId}\` on **${panel.name}** has been successfully updated with a new visual identity.`)
                .addFields(
                    { name: '✨ New Identity', value: `\`${newName}\``, inline: true },
                    { name: '🆔 Core Identifier', value: `\`${serverId}\``, inline: true },
                    { name: '🌐 Panel', value: panel.name, inline: true }
                )
                .setFooter({ text: 'The change is immediate across the registry.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const error = handleApiError(err, 'Identity Engine', 'update server display name', { serverId: interaction.options.getString("id") });
            await interaction.editReply({ embeds: [error] });
        }
    }
};
