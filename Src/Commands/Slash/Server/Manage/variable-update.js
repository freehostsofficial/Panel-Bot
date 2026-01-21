const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: "variable-update",
    description: "Modify environmental variables in the startup registry.",
    category: "Server",
    data: new SlashCommandBuilder()
        .setName("variable-update")
        .setDescription("Modify environmental variables in the startup registry.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("variable").setDescription("Environment key (env_variable)").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("value").setDescription("New configuration value").setRequired(true)),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'id') {
            await pteroUtils.serverAutocomplete(interaction);
        } else if (focusedOption.name === 'variable') {
            const combinedId = interaction.options.getString('id');
            if (!combinedId) return interaction.respond([]);

            const resolved = await pteroUtils.resolveServer(interaction, combinedId);
            if (!resolved) return interaction.respond([]);

            const { panel, serverId } = resolved;
            try {
                const variables = await ptero.getStartupVariables(panel.url, panel.apikey, serverId);
                const editableVars = variables.filter(v => v.attributes.is_editable);
                const filtered = editableVars
                    .filter(v => v.attributes.env_variable.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                        v.attributes.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25);
                await interaction.respond(filtered.map(v => ({
                    name: `${v.attributes.name} (${v.attributes.env_variable})`,
                    value: v.attributes.env_variable
                })));
            } catch (err) {
                await interaction.respond([]);
            }
        }
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resolved = await pteroUtils.resolveServer(interaction);
            if (!resolved) return interaction.editReply({ content: "❌ Server not found or panel connection failed.", ephemeral: true });

            const { panel, serverId } = resolved;
            const variableKey = interaction.options.getString("variable");
            const newValue = interaction.options.getString("value");

            await ptero.updateStartupVariable(panel.url, panel.apikey, serverId, variableKey, newValue);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('⚙️ Configuration Engine Updated')
                .setDescription(`Instance \`${serverId}\` on **${panel.name}** has been reconfigured with updated environment parameters.`)
                .addFields(
                    { name: '🔧 Variable Key', value: `\`${variableKey}\``, inline: true },
                    { name: '✨ New Parameter', value: `\`${newValue}\``, inline: true },
                    {
                        name: '🛡️ Requirement',
                        value: 'A full **Server Restart** is required to sync these changes with the container process.',
                        inline: false
                    }
                )
                .setFooter({ text: `Panel: ${panel.name} • Changes are persistent.` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Configuration Engine', 'patch environment variable', {
                serverId: interaction.options.getString("id"),
                action: 'Update Variable'
            });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
