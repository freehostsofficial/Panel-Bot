const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'create-folder',
    description: 'Provisions a new directory structure within the file system.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('create-folder')
        .setDescription('Provisions a new directory structure within the file system.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('name').setDescription('Name of the new folder').setRequired(true))
        .addStringOption(opt => opt.setName('root').setDescription('Parent directory (default: /)').setRequired(false)),

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
            const name = interaction.options.getString('name');
            const root = interaction.options.getString('root') || '/';

            await ptero.createDirectory(panel.url, panel.apikey, serverId, root, name);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('📂 Directory Provisioned')
                .setDescription(`A new resource container has been created on instance \`${serverId}\`.`)
                .addFields(
                    { name: '📁 Folder Name', value: `\`${name}\``, inline: true },
                    { name: '📍 Parent Path', value: `\`${root}\``, inline: true },
                    { name: '🌐 Panel', value: panel.name, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Directory Creation', 'create new folder', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
