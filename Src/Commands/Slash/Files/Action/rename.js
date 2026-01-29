const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'rename',
    description: 'Modifies the identifier or location of a specific file resource.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Modifies the identifier or location of a specific file resource.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('from').setDescription('Current file name').setRequired(true))
        .addStringOption(opt => opt.setName('to').setDescription('New file name').setRequired(true))
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
            const from = interaction.options.getString('from');
            const to = interaction.options.getString('to');
            const root = interaction.options.getString('root') || '/';

            await ptero.renameFiles(panel.url, panel.apikey, serverId, root, [{ from, to }]);

            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('✏️ Resource Renamed')
                .setDescription(`File system modification successful on instance \`${serverId}\`.`)
                .addFields(
                    { name: '📤 Original', value: `\`${from}\``, inline: true },
                    { name: '📥 New Name', value: `\`${to}\``, inline: true },
                    { name: '📂 Directory', value: `\`${root}\``, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'File Rename', 'rename resource', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
