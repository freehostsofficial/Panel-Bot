const { SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { createPaginatedEmbed, chunkArray } = require('../../../../Functions/pagination');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'list',
  description: 'Navigate the remote environmental file system.',
  category: 'Files',
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('Navigate the remote environmental file system.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('directory').setDescription('Directory path (default: /)').setRequired(false)),

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
      const directory = interaction.options.getString('directory') || '/';

      const files = await ptero.listFiles(panel.url, panel.apikey, serverId, directory);

      if (files.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('📁 Directory Empty')
          .setDescription(`No accessible files or folders in \`${directory}\`.`)
          .setFooter({ text: `Server: ${serverId} • Panel: ${panel.name}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // Sort: folders first, then alphabetical
      const sortedFiles = files.sort((a, b) => {
        if (a.attributes.is_file === b.attributes.is_file) {
          return a.attributes.name.localeCompare(b.attributes.name);
        }
        return a.attributes.is_file ? 1 : -1;
      });

      const chunked = chunkArray(sortedFiles, 10);
      const embeds = chunked.map((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor('#a349ff')
          .setTitle(` File Browser: ${serverId}`)
          .setDescription(`Path: \`${directory}\` — Total: \`${files.length}\` items`)
          .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Panel: ${panel.name}` })
          .setTimestamp();

        let list = '';
        chunk.forEach(f => {
          const attr = f.attributes;
          const icon = attr.is_file ? '📄' : '📁';
          const size = attr.is_file ? `(${(attr.size / 1024).toFixed(1)}KB)` : '';
          list += `${icon} **${attr.name}** ${size}\n`;
        });

        embed.setDescription(`Path: \`${directory}\` — Total: \`${files.length}\` items\n\n${list}`);
        return embed;
      });

      await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'File Browser', 'list files', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
