// FIND PACKAGES
const Discord = require('discord.js')
const tagClient = new Discord.Client({partials: ["MESSAGE", "CHANNEL", "REACTION"]})
// const db = require('quick.db');
const fs = require('fs');
const yaml = require('js-yaml')
const schedule = require('node-schedule');
const humanizeDuration = require('humanize-duration')


// FETCH UNUSED BUT WORKS FOR FUTURE
const { hypixelFetch, plotzesFetch, fetch } = require('./mystFetch.js')

// SETUP CONFIG
let tagConfig = yaml.loadAll(fs.readFileSync('config.yaml', 'utf8'))[2]

console.log(tagConfig)

const package = JSON.parse(fs.readFileSync('package.json'))


const embedColors = {
    green:"#3bcc71",
    red:"#e74c3c",
    blue:"#3498db",
    black:"#000000"
}

var tagQueues = {}
tagQueues[tagConfig.soloChannelID] = []
tagQueues[tagConfig.duoChannelID] = []
tagQueues[tagConfig.teamChannelID] = []
var tagQueueLimits = {};
tagQueueLimits[tagConfig.soloChannelID] = 1;
tagQueueLimits[tagConfig.duoChannelID] = 2;
tagQueueLimits[tagConfig.teamChannelID] = 4;
var tagParties = {}
var tagPartyInvites = {}
var tagQueueJoins = {}

async function memberExistsInTagGuild(guild, id) {
    var exists = true;
    try { await guild.members.fetch(id) } catch { exists = false }
    return exists;
}
async function generateTagTeams(players, limit) {
    var partiedPlayers = {}
    for (let u = 0; u<players.length; u++) {
        let partyID = findParty(players[u])
        if (partyID in partiedPlayers) {
            partiedPlayers[partyID].push(players[u])
        }
        else {
            partiedPlayers[partyID] = [players[u]]
        }
    }
    if (0 in partiedPlayers) {
        var nonPartiedPlayers = partiedPlayers[0]
        delete partiedPlayers[0]
    }
    else {
        var nonPartiedPlayers = []
    }
    var teamA = []
    var teamB = []

    for (party in partiedPlayers) {
        let APossible = (limit - teamA.length >= partiedPlayers[party].length)
        let BPossible = (limit = teamB.length >= partiedPlayers[party].length)

        if (APossible && BPossible) {
            if (randInt(1, 2) == 1) {
                teamA = teamA.concat(partiedPlayers[party])
                delete partiedPlayers[party]
            }
            else {
                teamB = teamB.concat(partiedPlayers[party])
                delete partiedPlayers[party]
            }
        }
        else if (APossible) {
            teamA = teamA.concat(partiedPlayers[party])
            delete partiedPlayers[party]
        }
        else if (BPossible) {
            teamB = teamB.concat(partiedPlayers[party])
            delete partiedPlayers[party]
        }
        else {
            nonPartiedPlayers = nonPartiedPlayers.concat(partiedPlayers[party])
            delete partiedPlayers[party]
            continue;
        }
    }


    nonPartiedPlayers = shuffle(nonPartiedPlayers)

    teamA = teamA.concat(nonPartiedPlayers.splice(0, limit - teamA.length))
    teamB = teamB.concat(nonPartiedPlayers)


    return {"A":teamA, "B":teamB}
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function findParty(player) {
    if (player in tagParties) return player;
    for (party in tagParties) {
        if (tagParties[party].includes(player)) {
            return party
        }
    }
    return 0;
}

function inParty(player) {
    var partyLeaders = Object.keys(tagParties)
    var partyPlayers = partyLeaders

    for(let i = 0; i < partyLeaders.length; i++) {
        partyPlayers = partyPlayers.concat(tagParties[partyLeaders[i]])
    }

    return partyPlayers.includes(player)
}

function inGame(player) {
    var gameKeys = Object.keys(tagQueues)
    var gamePlayers = []

    for(let i = 0; i < gameKeys.length; i++) {
        gamePlayers = gamePlayers.concat(tagQueues[gameKeys[i]])
    }

    return gamePlayers.includes(player)
}

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes()
    var sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds()
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

tagClient.on('ready', async () => {
    console.log('Bot: Tag Server Bot is online!');
    tagClient.user.setActivity("TNT Tag");

    schedule.scheduleJob('0 0 * * * *', async function() {

        console.log("Updating Tag ppl")

        let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
        let penaltiesGivenKeys = Object.keys(penaltiesGiven)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        for (let k = 0; k < penaltiesGivenKeys.length; k++) {
            if (Date.now() - penaltiesGiven[penaltiesGivenKeys[k]] > 4 * 7 * 24 * 60 * 60 * 1000) {
                let tagMember = await tagGuild.members.fetch(penaltiesGivenKeys[k])
                if (tagMember.roles.cache.has(tagConfig.yellowCardRoleID)) {
                    tagMember.roles.remove(yellowCardRole)
                    delete penaltiesGiven[penaltiesGivenKeys[k]]
            }
            if (Date.now() - penaltiesGiven[penaltiesGivenKeys[k]] > 6 * 7 * 24 * 60 * 60 * 1000) {
                if (tagMember.roles.cache.has(tagConfig.redCardRoleID)) {
                    tagMember.roles.remove(redCardRole)
                }
                delete penaltiesGiven[penaltiesGivenKeys[k]]
            }
            }
        }
        fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
    })
    schedule.scheduleJob('0 */5 * * * *', async function() {
        
        console.log("Updating Tag ppl (Kicking inactives)")

        for (user in tagQueueJoins) {
            if (Date.now() - tagQueueJoins[user][0] > 60 * 60 * 1000) {
                if (tagQueues[tagQueueJoins[user][1]].includes(user)) {
                    let tagChannel = await tagClient.channels.fetch(tagQueueJoins[user][1])
                    tagChannel.send(`<@!${user}> was removed from the queue after remaining in it for over an hour`)
                }
                delete tagQueueJoins[user]
            }
        }
    })
});

tagClient.on('message', async m => {

    //console.log(m)

    if(m.author.bot) return;

    if(m.channel.id == tagConfig.ignChannelID) {
        console.log(m.author.username+": " + m.content)
        m.member.setNickname(m.content).catch(() => m.channel.send("I need permissions"))
        return
    }

    var prefix = "="
    if(!m.content.startsWith(prefix)) return

    var args = m.content.toLowerCase().slice(prefix.length).split(' ');
    const command = args.shift().toLowerCase()

    console.log(m.author.username+": " + m.content)
    if (command == "help") {

        if (m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID)) {
            return m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.blue)
            .setTitle('**Help Menu**')
            .setDescription(`**${prefix}join or ${prefix}j** - Join the queue of the lobby you are in
    **${prefix}leave or ${prefix}l** - Leave the queue
    **${prefix}queue or ${prefix}q** - See who is in this queue
    **${prefix}setplayercount {count}** - Set the player count of the team lobby
    
    **${prefix}p invite or ${prefix}p i {user mention}** - Invite a player to your party (party owner only)
    **${prefix}p leave** - Leave a party
    **${prefix}p kick {user mention}** - Kick a player from the party (party owner only)
    **${prefix}p list** - List all players in your party
    **${prefix}p disband** - Disband the party (party owner only)
    *You have a much higher chance to be with players in the same party. Both players need to join separately, however*
    
    **Staff-only Commands**
    **${prefix}green {user mention}** - Removes all penalties from the specified user
    **${prefix}yellow {user mention}** - Gives the specified user a yellow card. If they already have a yellow card, they get a red one
    **${prefix}red {user mention}** - Gives the specified user a red card.
    **${prefix}status** - Gives a list of all those with penalty cards and when they expire.
    **${prefix}forcejoin {user mention}** - Forces a user to join that game
    **${prefix}forcekick {user mention}** - Force Kicks a user out of that game
    *Cards are automatically taken away when they expire.*`)
            .setTimestamp()
            .setFooter("TNT Tag Bot created by Mysterium_"))
        }
        else {
            return m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.blue)
            .setTitle('**Help Menu**')
            .setDescription(`**${prefix}join or ${prefix}j** - Join the queue of the lobby you are in
    **${prefix}leave or ${prefix}l** - Leave the queue
    **${prefix}queue or ${prefix}q** - See who is in this queue
    **${prefix}setplayercount {count}** - Set the player count of the team lobby
    
    **${prefix}p invite or ${prefix}p i {user mention}** - Invite a player to your party (party owner only)
    **${prefix}p leave** - Leave a party
    **${prefix}p kick {user mention}** - Kick a player from the party (party owner only)
    **${prefix}p list** - List all players in your party
    **${prefix}p disband** - Disband the party (party owner only)
    *You have a much higher chance to be with players in the same party. Both players need to join separately, however*`)
            .setTimestamp()
            .setFooter("TNT Tag Bot created by Mysterium_"))
        }
    }
    else if (command == "yellow") {
        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID))) {
            return;
        }

        if (m.mentions.users.size == 0) {
            /**const embed = new Discord.MessageEmbed()
        .setColor('#00BF00')
        .setAuthor(`${m.author.tag}`, `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}?size=128`)
        .setTitle(`Success! Channel Configured`)
        .setTimestamp()
        .setFooter(embedFooter.text[randInt(0, embedFooter.text.length - 1)], embedFooter.image.green)
        .addField(`__Default Game:__`, configurationTool[args[0]], true)
        .addField(`__Bot Prefix:__`, args[1], true)
        return m.channel.send(embed)*/
        return m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.black)
            .setDescription("Please mention the user(s) you are attempting to give a yellow card to"))
        }

        let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        m.mentions.members.forEach(async (pinged) => {
            if (pinged.user.bot) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`I refuse to penalize my own kind (<@!${pinged.id}>)!`))
            }
            if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`Could not find player <@!${pinged.id}>!`))
            }
            if (pinged.roles.cache.has(tagConfig.redCardRoleID)) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`<@!${pinged.id}> already has a red card!`))
            }
            else if (pinged.roles.cache.has(tagConfig.yellowCardRoleID)) {
                pinged.roles.remove(yellowCardRole)
                pinged.roles.add(redCardRole)
                penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
                penaltiesGiven[pinged.id] = Date.now()
                fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.green)
                    .setDescription(`Upgraded the yellow card to a red card for <@!${pinged.id}>`))
            }
            else {
                pinged.roles.add(yellowCardRole)
                penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
                penaltiesGiven[pinged.id] = Date.now()
                fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.green)
                    .setDescription(`Gave a yellow card to <@!${pinged.id}>`))
            }
        })
    }

    else if (command == "red") {
        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID))) {
            return;
        }

        if (m.mentions.users.size == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Please mention the user(s) you are attempting to give a red card to"))
        }

        let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        m.mentions.members.forEach(async (pinged) => {
            if (pinged.user.bot) { 
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`I refuse to penalize my own kind (<@!${pinged.id}>)!`))
            }
            if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`Could not find player <@!${pinged.id}>!`))
            }

            if (pinged.roles.cache.has(tagConfig.yellowCardRoleID)) {
                pinged.roles.remove(yellowCardRole)
            }
            if (pinged.roles.cache.has(tagConfig.redCardRoleID)) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`<@!${pinged.id}> already has a red card!`))
            }
            pinged.roles.add(redCardRole)
            penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
            penaltiesGiven[pinged.id] = Date.now()
            fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`Gave a red card to <@!${pinged.id}>`))
        })
    }

    else if (command == "green") {
        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID))) {
            return;
        }

        if (m.mentions.users.size == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Please mention the user(s) you are attempting to remove cards from"))
        }

        let tagGuild = tagClient.guilds.cache.get(tagConfig.tagGuildID)
        let yellowCardRole = await tagGuild.roles.cache.get(tagConfig.yellowCardRoleID)
        let redCardRole = await tagGuild.roles.cache.get(tagConfig.redCardRoleID)
        m.mentions.members.forEach(async (pinged) => {
            if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`Could not find player <@!${pinged.id}>!`))
            }
            if (pinged.roles.cache.has(tagConfig.yellowCardRoleID) || pinged.roles.cache.has(tagConfig.redCardRoleID)) {
                pinged.roles.remove(yellowCardRole)
                pinged.roles.remove(redCardRole)
                penaltiesGiven = JSON.parse(fs.readFileSync('penalties.json'))
                delete penaltiesGiven[pinged.id]
                fs.writeFileSync('penalties.json', JSON.stringify(penaltiesGiven))
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.green)
                    .setDescription(`Removed all penalties from <@!${pinged.id}>`))
            }
            else {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.green)
                    .setDescription(`<@!${pinged.id}> had no penalties to remove`))
            }
        })
    }
    else if (command == "status") {
        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID))) {
            return;
        }

        var penaltyJson = JSON.parse(fs.readFileSync('penalties.json'))
        var penaltyJSONArray = []

        
        let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)

        for (player in penaltyJson) {
            let tagMember = await tagGuild.members.fetch(player).catch(() => {return "continue"})
            if (tagMember == "continue") {
                continue;
            }
            var cardName = ""
            if (tagMember.roles.cache.has(tagConfig.redCardRoleID)) {
                cardName = "red"
            }
            else if (tagMember.roles.cache.has(tagConfig.yellowCardRoleID)) {
                cardName = "yellow"
            }
            else {
                continue
            }
            penaltyJSONArray.push({id:player, time:penaltyJson[player], card:cardName})
        }

        if (penaltyJson == {}) {
            return  m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.blue)
                .setDescription("No cards found"))
        }

        penaltyJSONArray = penaltyJSONArray.sort((a, b) => {
            return a.time - b.time
        })

        var res = ""
        var penaltyJSONArrayRed = penaltyJSONArray.filter((a) => {return a.card == "red"})
        var penaltyJSONArrayYellow = penaltyJSONArray.filter((a) => {return a.card == "yellow"})
        for (let r = 0; r < penaltyJSONArrayRed.length; r++) {
            res = `${res}\n:red_square: <@!${penaltyJSONArrayRed[r].id}> ${timeConverter(penaltyJSONArrayRed[r].time + 6 * 7 * 24 * 60 * 60 * 1000)}`
        }
        res = `${res}\n`
        for (let r = 0; r < penaltyJSONArrayYellow.length; r++) {
            res = `${res}\n:yellow_square: <@!${penaltyJSONArrayYellow[r].id}> ${timeConverter(penaltyJSONArrayYellow[r].time + 4 * 7 * 24 * 60 * 60 * 1000)}`
        }
        res = `${res}\n*All Dates are when the penalties will expire (be removed)`

        m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.blue)
            .setTitle("**Penalty Status Board**")
            .setDescription(res))
        fs.writeFileSync('penalties.json', JSON.stringify(penaltyJson))
    }
    else if (command == "signup") {
        var fileString = fs.readFileSync('signups.txt')
        
        if (m.mentions.users.size == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Please mention the user(s) you are attempting to remove cards from"))
        }
    }

    let tagChannels = [tagConfig.soloChannelID, tagConfig.duoChannelID, tagConfig.teamChannelID]
    if (!tagChannels.includes(m.channel.id)) return;
    if (command == 'queue' || command == 'q') {
        if(tagQueues[m.channel.id].length == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.red)
                .setDescription("No one in this queue"))
        }

        var queueResponse = ""
        for (let i = 0; i < tagQueues[m.channel.id].length; i++) {
            queueResponse = `${queueResponse}<@!${tagQueues[m.channel.id][i]}>\n`
        }
        return m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.blue)
            .setTitle(`**Game Queue** [${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}]`)
            .setDescription(`Creator: ${queueResponse}`))
    }
    else if (command == 'join' || command == 'j') {

        if (args.length > 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Too many args: Use just ${prefix}j`))
        }
        if(inGame(m.author.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("You are already in a game"))
        }

        tagQueues[m.channel.id].push(m.author.id)
        tagQueueJoins[m.author.id] = [Date.now(), m.channel.id]

        if (tagQueues[m.channel.id].length == 1) {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}] <@!${m.author.id}> created a new game.`))
        }
        else {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}] <@!${m.author.id}> joined the game.`))
        }

        if(tagQueues[m.channel.id].length > tagQueueLimits[m.channel.id]*2-1) {
            let gameCounters = await JSON.parse(fs.readFileSync('tagGameCounts.json'))
            gameCounters[m.channel.id] = gameCounters[m.channel.id] + 1
            fs.writeFileSync('tagGameCounts.json', JSON.stringify(gameCounters))

            var teams = await generateTagTeams(tagQueues[m.channel.id], tagQueueLimits[m.channel.id])
            var aString = ""
            var bString = ""
            for (let g = 0; g < teams.A.length; g++) {
                aString = `${aString}\n<@!${teams.A[g]}>`
            }
            for (let g = 0; g < teams.B.length; g++) {
                bString = `${bString}\n<@!${teams.B[g]}>`
            }
            let outputPingText = "";
            for (let j = 0; j < tagQueues[m.channel.id].length; j++) {
                outputPingText = `${outputPingText}<@!${tagQueues[m.channel.id][j]}> `
            }

            tagQueues[m.channel.id] = []
            return m.channel.send(outputPingText, {embed: new Discord.MessageEmbed()
                .setColor(embedColors.blue)
                .setTitle(`Game #${gameCounters[m.channel.id]}`)
                .setDescription(`**Creation Time:** ${timeConverter(Math.floor(Date.now()))}\n**Lobby:** <#${m.channel.id}>`)
                .addField('**Team 1**', aString)
                .addField('**Team 2**', bString)
            })
        }
    }
    else if (command == "setplayercount") {
        if (m.channel.id !== tagConfig.teamChannelID) return;

        if (!tagQueues[m.channel.id].includes(m.author.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`You are not in the game.`))
        }

        if (m.author.id !== tagQueues[m.channel.id][0]) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Only the game creator, <@!${tagQueues[m.channel.id][0]}>, can do this.`))
        }

        if (!isFinite(args[0])) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Specify a valid number"))
        }
        if (args[0] < 3 || args[0] > 14) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Must be between 3 and 14"))
        }

        tagQueueLimits[m.channel.id] = Math.floor(args[0])
        return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`Players per team set to ${args[0]}`))
    }
    else if (command == "leave" || command == "l") {
        if (args.length > 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Too many args: Use just ${prefix}l`))
        }

        if(!inGame(m.author.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`You are not in any game`))
        }

        if (tagQueues[m.channel.id].indexOf(m.author.id) > -1) {
            tagQueues[m.channel.id].splice(tagQueues[m.channel.id].indexOf(m.author.id), 1)
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.red)
                .setDescription(`[${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}] <@!${m.author.id}> has left the game.`))
        }
        else {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`You are not in this game`))
        }
    }
    else if (command == "forcejoin") {

        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID) || m.member.roles.cache.has(tagConfig.helperRoleID))) {
            return;
        }

        if (m.mentions.members.size == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Please mention the user you are attempting to force-join"))
        }

        if (m.mentions.members.size > 1) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("I can only force-join one user at a time"))
        }

        pinged = m.mentions.members.first()

        if (pinged.user.bot) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Bots can't join/leave games!`))
        }

        if(inGame(pinged.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Player <@!${pinged.id}> is already in a game`))
        }

        tagQueues[m.channel.id].push(pinged.id)
        tagQueueJoins[pinged.id] = [Date.now(), m.channel.id]

        if (tagQueues[m.channel.id].length == 1) {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}] <@!${pinged.id}> created a new game.`))
        }
        else {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}] <@!${pinged.id}> joined the game.`))
        }

        if(tagQueues[m.channel.id].length > tagQueueLimits[m.channel.id]*2-1) {
            let gameCounters = await JSON.parse(fs.readFileSync('tagGameCounts.json'))
            gameCounters[m.channel.id] = gameCounters[m.channel.id] + 1
            console.log(gameCounters)
            fs.writeFileSync('tagGameCounts.json', JSON.stringify(gameCounters))

            var teams = await generateTagTeams(tagQueues[m.channel.id], tagQueueLimits[m.channel.id])
            var aString = ""
            var bString = ""
            for (let g = 0; g < teams.A.length; g++) {
                aString = `${aString}\n<@!${teams.A[g]}>`
            }
            for (let g = 0; g < teams.B.length; g++) {
                bString = `${bString}\n<@!${teams.B[g]}>`
            }
            let outputPingText = "";
            for (let j = 0; j < tagQueues[m.channel.id].length; j++) {
                outputPingText = `${outputPingText}<@!${tagQueues[m.channel.id][j]}> `
            }

            tagQueues[m.channel.id] = []
            return m.channel.send(outputPingText, {embed: new Discord.MessageEmbed()
                .setColor(embedColors.blue)
                .setTitle(`Game #${gameCounters[m.channel.id]}`)
                .setDescription(`**Creation Time:** ${timeConverter(Math.floor(Date.now()))}\n**Lobby:** <#${m.channel.id}>`)
                .addField('**Team 1**', aString)
                .addField('**Team 2**', bString)
            })
        }        
    }

    else if (command == "forcekick") {

        if (!(m.member.roles.cache.has(tagConfig.adminRoleID) || m.member.roles.cache.has(tagConfig.moderatorRoleID) || m.member.roles.cache.has(tagConfig.helperRoleID))) {
            return;
        }

        if (m.mentions.members.size == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Please mention the user you are attempting to force-kick"))
        }

        if (m.mentions.members.size > 1) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("I can only force-kick one user at a time"))
        }

        pinged = m.mentions.members.first()

        if (pinged.user.bot) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Bots can't join/leave games!`))
        }

        if(!inGame(pinged.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Player <@!${pinged.id}> is not in any game`))
        }

        if (tagQueues[m.channel.id].indexOf(pinged.id) > -1) {
            tagQueues[m.channel.id].splice(tagQueues[m.channel.id].indexOf(pinged.id), 1)
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.red)
                .setDescription(`[${tagQueues[m.channel.id].length}/${tagQueueLimits[m.channel.id]*2}] <@!${pinged.id}> has left the game.`))
        }
        else {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`You are not in this game`))
        }
    }

    else if (command == "party" || command == "p") {
        if (args[0] == "invite" || args[0] == "i") {
            if (m.mentions.users.size == 0) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("Please mention the user(s) you are attempting to invite"))
            }
            if (inParty(m.author.id) && !(m.author.id in tagParties)) {
                return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Only the party leader can do this.`))
            }
            let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
            m.mentions.users.forEach(async (pinged) => {
                if (pinged.bot) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription("You can't invite bots!"))
                }
                if (pinged.id == m.author.id) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription("You can't invite yourself!"))
                }
                if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription(`Could not find player <@!${pinged.id}>!`))
                }
                if (inParty(pinged.id)) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription(`Player <@!${pinged.id}> is already in a party!`))
                }
                let message = await m.channel.send(`<@!${pinged.id}>`, {embed: new Discord.MessageEmbed()
                    .setColor(embedColors.blue)
                    .setDescription(`<@!${pinged.id}> Click the check mark below to join <@!${m.author.id}>'s party`)
                })
                tagPartyInvites[message.id] = [m.author.id, pinged.id]
                await message.react('✅')
                await message.react('❌')
                setTimeout(async function () {

                    delete tagPartyInvites[message.id]

                    let channelMsgDelete = await tagClient.channels.fetch(m.channel.id)
                    messageDelete = await channelMsgDelete.messages.fetch(message.id).catch((err) => {return "ERROR"})
                    
                    if (messageDelete != "ERROR") {
                        message.edit(new Discord.MessageEmbed()
                            .setColor(embedColors.red)
                            .setDescription(`Party Invite Expired`), )
                        message.reactions.cache.forEach(reaction => reaction.remove('820677045603270696'))
                    }
                    return

                }, 10 * 1000);
            })
        }
        else if (args[0] == "disband") {
            if (m.author.id in tagParties) {
                delete tagParties[m.author.id]
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.red)
                    .setDescription("You have disbanded the party"))
            }
            else if (inParty(m.author.id)) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("Only the party leader can do this"))
            }
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("You are not in a party"))
        }
        else if (args[0] == "leave") {
            if (!inParty(m.author.id)) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("You are not in a party"))
            }

            if (m.author.id in tagParties) {
                m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.red)
                    .setDescription(`<@!${m.author.id}> has left the party`))
                if (tagParties[m.author.id].length == 1) {
                    delete tagParties[m.author.id]
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription(`Party has been disbanded`))
                }
                else {
                    tagParties[tagParties[m.author.id][0]] = tagParties[m.author.id]
                    tagParties[tagParties[m.author.id][0]].shift()
                    m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.blue)
                        .setDescription(`Party ownership has transfered over to <@!${tagParties[m.author.id][0]}>`))
                    return delete tagParties[m.author.id]
                }    
            }
            else {
                for (let u = 0; u < Object.keys(tagParties); u++) {
                    if (tagParties[Object.keys(tagParties)[u]].includes(m.author.id)) {
                        tagParties[Object.keys(tagParties)[u]].splice(tagParties[Object.keys(tagParties)[u]].indexOf(m.author.id), 1)
                        m.channel.send(new Discord.MessageEmbed()
                            .setColor(embedColors.red)
                            .setDescription(`<@!${m.author.id}> has left the party`))
                        break;
                    }
                }
                return;
            }
        }
        else if (args[0] == "kick") {
            if (!inParty(m.author.id)) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("You are not in a party"))
            }

            if (inParty(m.author.id) && !(m.author.id in tagParties)) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("Only the party leader can do this"))
            }

            m.mentions.users.forEach(async (pinged) => {
                if (!tagParties[m.author.id].includes(pinged.id)) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription("Player is not in the party"))
                }

                tagParties[m.author.id].splice(tagParties[m.author.id].indexOf(pinged.id), 1)
                m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.red)
                    .setDescription(`<@!${pinged.id}> was kicked from the party`))
            })

            if (tagParties[m.author.id].length == 0) {
                delete tagParties[m.author.id]
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription(`Party has been disbanded`))
            }
        }
        else if (args[0] == "list") {
            if (!inParty(m.author.id)) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("You are not in a party"))
            }
            if (m.author.id in tagParties) {
                response = ""
                for (let i = 0; i < tagParties[m.author.id].length; i++) {
                    response = `${response}<@!${tagParties[m.author.id][i]}>\n`
                }

                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.blue)
                    .setTitle('**Party List**')
                    .setDescription(`**Owner:** <@!${m.author.id}>
**Party Members:** ${response}`))
            }
            else {
                tagPartiesKeys = Object.keys(tagParties)
                for (let u = 0; u < tagPartiesKeys; u++) {
                    if (tagParties[tagPartiesKeys[u]].includes(m.author.id)) {
                        response = ""
                        for (let i = 0; i < tagParties[tagPartiesKeys[u]].length; i++) {
                            response = `${response}\n<@!${tagParties[tagPartiesKeys[u]][i]}>`
                        }
                        m.channel.send(new Discord.MessageEmbed()
                            .setColor(embedColors.blue)
                            .setTitle('**Party List**')
                            .setDescription(`**Owner:** <@!${tagPartiesKeys[u]}>
**Party Members:** ${response}`))
                        break;
                    }
                }
            }
        }
        else {
            if (m.mentions.users.size == 0) {
                return m.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("Please mention the user(s) you are attempting to invite"))
            }
            if (inParty(m.author.id) && !(m.author.id in tagParties)) {
                return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Only the party leader can do this.`))
            }
            let tagGuild = await tagClient.guilds.cache.get(tagConfig.tagGuildID)
            m.mentions.users.forEach(async (pinged) => {
                if (pinged.bot) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription("You can't invite bots!"))
                }
                if (pinged.id == m.author.id) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription("You can't invite yourself!"))
                }
                if (!(memberExistsInTagGuild(tagClient.guilds.cache.get(tagConfig.tagGuildID), pinged.id))) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription(`Could not find player <@!${pinged.id}>!`))
                }
                if (inParty(pinged.id)) {
                    return m.channel.send(new Discord.MessageEmbed()
                        .setColor(embedColors.black)
                        .setDescription(`Player <@!${pinged.id}> is already in a party!`))
                }
                let message = await m.channel.send(`<@!${pinged.id}>`, {embed: new Discord.MessageEmbed()
                    .setColor(embedColors.blue)
                    .setDescription(`<@!${pinged.id}> Click the check mark below to join <@!${m.author.id}>'s party`)
                })
                tagPartyInvites[message.id] = [m.author.id, pinged.id]
                await message.react('✅')
                await message.react('❌')
                setTimeout(async function () {

                    delete tagPartyInvites[message.id]

                    let channelMsgDelete = await tagClient.channels.fetch(m.channel.id)
                    messageDelete = await channelMsgDelete.messages.fetch(message.id).catch((err) => {return "ERROR"})
                    
                    if (messageDelete != "ERROR") {
                        message.edit(new Discord.MessageEmbed()
                            .setColor(embedColors.red)
                            .setDescription(`Party Invite Expired`), )
                        message.reactions.cache.forEach(reaction => reaction.remove('820677045603270696'))
                    }
                    return

                }, 10 * 1000);
            })
        }
    }
})

tagClient.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.message.partial) await reaction.message.fetch()
    if (reaction.partial) await reaction.fetch()
    if (user.bot) return
    if (!reaction.message.guild) return;

    if (!(reaction.message.id in tagPartyInvites)) return;

    if (!(tagPartyInvites[reaction.message.id][1] == user.id)) return;

    let tagChannels = [tagConfig.soloChannelID, tagConfig.duoChannelID, tagConfig.teamChannelID]
    if (tagChannels.includes(reaction.message.channel.id)) {
        if (reaction.emoji.name === '✅') {
            reaction.message.delete()
            if (inParty(user.id)) {
                delete tagPartyInvites[reaction.message.id]
                return reaction.message.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.black)
                    .setDescription("You are already in a party"))
            }
            if (tagPartyInvites[reaction.message.id][0] in tagParties) {
                tagParties[tagPartyInvites[reaction.message.id][0]].push(user.id)
            }
            else {
                tagParties[tagPartyInvites[reaction.message.id][0]] = [user.id]
            }
            reaction.message.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.green)
                    .setDescription(`<@!${user.id}> has joined <@!${tagPartyInvites[reaction.message.id][0]}>'s party`))
            return delete tagPartyInvites[reaction.message.id]
        }
        else if (reaction.emoji.name === '❌') {
            reaction.message.delete()
            delete tagPartyInvites[reaction.message.id]
            return reaction.message.channel.send(new Discord.MessageEmbed()
                    .setColor(embedColors.green)
                    .setDescription(`Sorry! <@!${user.id}> isn't interested!`))
        }
        return
    }

})

tagClient.login(tagConfig.TagBotToken);