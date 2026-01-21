const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');

module.exports = {
  name: 'listroles',
  description: 'List all roles in the server with pagination',
  category: 'Info',
  usage: '/info server listroles',
  cooldown: 10,
  devOnly: false,
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName('listroles')
    .setDescription('Displays all server roles'),

  async execute(client, interaction) {
    await interaction.deferReply();

    const guild = interaction.guild;
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`);

    if (roles.length === 0) {
      return interaction.editReply('This server has no roles.');
    }

    const rolesPerPage = 20;
    const pages = [];
    for (let i = 0; i < roles.length; i += rolesPerPage) {
      pages.push(roles.slice(i, i + rolesPerPage).join('\n'));
    }

    let page = 0;

    const createEmbed = () => {
      return new EmbedBuilder()
        .setTitle(`🎭 Roles in ${guild.name}`)
        .setColor(Colors.Blurple)
        .setDescription(pages[page])
        .setFooter({ 
          text: `Page ${page + 1}/${pages.length} • Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();
    };

    const createButtons = () => {
      return new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('first')
            .setLabel('⏮️ First')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('⬅️ Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === pages.length - 1),
          new ButtonBuilder()
            .setCustomId('last')
            .setLabel('⏭️ Last')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === pages.length - 1)
        );
    };

    const msg = await interaction.editReply({ embeds: [createEmbed()], components: [createButtons()] });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 120000 // 2 minutes
    });

    collector.on('collect', async i => {
      switch(i.customId) {
        case 'first': page = 0; break;
        case 'prev': if (page > 0) page--; break;
        case 'next': if (page < pages.length - 1) page++; break;
        case 'last': page = pages.length - 1; break;
      }

      await i.update({ embeds: [createEmbed()], components: [createButtons()] });
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('first').setLabel('⏮️ First').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('prev').setLabel('⬅️ Previous').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('next').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('last').setLabel('⏭️ Last').setStyle(ButtonStyle.Primary).setDisabled(true)
        );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  }
};
