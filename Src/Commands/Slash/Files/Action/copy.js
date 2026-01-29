const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'copy',
    description: 'Duplicates a target resource within the file system.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('copy')
        .setDescription('Duplicates a target resource within the file system.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('file').setDescription('File path to copy').setRequired(true)),

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
            const location = interaction.options.getString('file');

            await ptero.copyFiles(panel.url, panel.apikey, serverId, location);

            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('📋 Resource Duplicated')
                .setDescription(`A replica of \`${location}\` has been created on instance \`${serverId}\`.`)
                .setFooter({ text: `Panel: ${panel.name} • Copy created with standard extension.` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'File Copy', 'duplicate resource', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
