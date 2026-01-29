const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError, createSuccessEmbed } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'assign',
    description: 'Provision a new network ingress port.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('assign')
        .setDescription('Provision a new network ingress port.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resolved = await pteroUtils.resolveServer(interaction);
            if (!resolved) {
                return interaction.editReply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
            }

            const { panel, serverId } = resolved;
            const allocation = await ptero.assignAllocation(panel.url, panel.apikey, serverId);

            const embed = createSuccessEmbed(
                'Allocation Assigned',
                `Successfully assigned a new network port to server \`${serverId}\`.`,
                [
                    { name: '🔌 IP Address', value: `\`${allocation.ip}\``, inline: true },
                    { name: '🚪 Port', value: `\`${allocation.port}\``, inline: true },
                    { name: '🆔 Allocation ID', value: `\`${allocation.id}\``, inline: true }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Network Provisioning', 'assign new allocation', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
