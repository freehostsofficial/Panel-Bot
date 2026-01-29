const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'chmod',
    description: 'Modifies the access permission bits of a specific resource.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('chmod')
        .setDescription('Modifies the access permission bits of a specific resource.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('file').setDescription('File name').setRequired(true))
        .addStringOption(opt => opt.setName('mode').setDescription('New permission mode (e.g. 0644, 0755)').setRequired(true))
        .addStringOption(opt => opt.setName('root').setDescription('Directory path (default: /)').setRequired(false)),

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
            const file = interaction.options.getString('file');
            const mode = interaction.options.getString('mode');
            const root = interaction.options.getString('root') || '/';

            await ptero.changeFilePermissions(panel.url, panel.apikey, serverId, root, [{ file, mode }]);

            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🔐 Permissions Updated')
                .setDescription(`Access bits for \`${file}\` have been modified on instance \`${serverId}\`.`)
                .addFields(
                    { name: '📄 Resource', value: `\`${file}\``, inline: true },
                    { name: '🔢 New Mode', value: `\`${mode}\``, inline: true },
                    { name: '📂 Directory', value: `\`${root}\``, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Permission Update', 'chmod resource', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
