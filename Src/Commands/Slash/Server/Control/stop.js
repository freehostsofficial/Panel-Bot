const { SlashCommandBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: "stop",
    description: "Execute a graceful environmental shutdown protocol.",
    category: "Server",
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Execute a graceful environmental shutdown protocol.")
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
            await ptero.sendPowerAction(panel.url, panel.apikey, serverId, "stop");

            const embed = createSuccessEmbed(
                'Server Stopping',
                `Successfully sent **stop** signal to server \`${serverId}\`.`,
                [
                    { name: '🔴 Action', value: 'Stop', inline: true },
                    { name: '⏳ Status', value: 'Shutting down...', inline: true },
                    { name: '🏢 Panel', value: panel.name, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Server Stop', 'stop server', { serverId: interaction.options.getString("id") });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
