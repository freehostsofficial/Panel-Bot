const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'content',
  description: 'Analyze raw source data from a remote instance file.',
  category: 'Files',
  data: new SlashCommandBuilder()
    .setName('content')
    .setDescription('Analyze raw source data from a remote instance file.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('file').setDescription('Full file path (e.g. server.properties)').setRequired(true)),

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
      const filePath = interaction.options.getString('file');

      const content = await ptero.getFileContent(panel.url, panel.apikey, serverId, filePath);

      if (!content || content.trim() === '') {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF9900')
              .setTitle('📄 File Content: Empty')
              .setDescription(`The file \`${filePath}\` is empty or only contains whitespace.`)
              .setTimestamp()
          ]
        });
      }

      // Truncate if too long (Discord limit is ~4000 characters for embed description)
      // We use 3800 to be safe with code blocks and headers
      const isTruncated = content.length > 3800;
      const displayContent = isTruncated ? content.substring(0, 3800) + '\n\n... (file truncated due to size limit)' : content;

      // Determine language for code block if possible
      const ext = filePath.split('.').pop().toLowerCase();
      const langMap = {
        'js': 'js', 'json': 'json', 'py': 'python', 'yml': 'yaml', 'yaml': 'yaml',
        'properties': 'properties', 'log': 'log', 'txt': 'text', 'sh': 'bash', 'conf': 'conf'
      };
      const lang = langMap[ext] || '';

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`📄 Reading: ${filePath}`)
        .setDescription(`\`\`\`${lang}\n${displayContent}\n\`\`\``)
        .addFields(
          { name: '🆔 Server', value: `\`${serverId}\``, inline: true },
          { name: '📊 Total Size', value: `\`${(content.length / 1024).toFixed(2)} KB\``, inline: true }
        )
        .setFooter({ text: isTruncated ? '⚠️ File too large for full Discord preview.' : 'Full content retrieved successfully.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'File Reader', 'fetch file content', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
