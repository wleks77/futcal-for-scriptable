// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: futbol;

// Team selection
const teamId = 9768;

// Time zone selection
const timeZone = "Europe/London";

// Show match round name
const showRound = false;
// Show current playing time on live matches
const showLivetime = false;
// Show league subtitle - for leagues with more than one table, e.g. "MLS (EASTERN)"
const showLeagueSubtitle = false;
// Show match kick off time in 12 hour clock format
const twelveHourClock = false;

// Background Image
const backgroundImage = "background.png"; // not required - needs to be saved on iCloud Drive/Scriptable/Futcal with this name and extension

// UI colors
const backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e")); // Color for background - default same as calendar widget
const leagueTitleColor = Color.red(); // Color for league table title - default same as calendar widget
const positionColor = Color.red(); // Color to highlight current position in table - default same as calendar widget
const liveColor = Color.red(); // Color for live dot on Live events

// By default both views are shown
let showMatchesView = true;
let showTableView = true;

// iCloud directory to store cached data / background image
const folder = "Futcal";

// APIs
const apiBaseUrl = encodeURI("https://www.fotmob.com");
const teamOverviewUrl = encodeURI(apiBaseUrl + "/teams?id=" + teamId + "&tab=overview&type=team&timeZone=" + timeZone);
const teamFixturesUrl = encodeURI(apiBaseUrl + "/teams/" + teamId + "/fixtures");
const fixtureDetailsUrl = encodeURI(apiBaseUrl + "/matchDetails?matchId=");

// Language settings
let preferredLanguage = Device.preferredLanguages()[0];
let lang = preferredLanguage.split("-")[0];
let supportedLang = ["en", "pt", "fr", "de"];
if (!(supportedLang.includes(lang))) {
    lang = "en";
}
let dictionary = getDictionary(lang);

// Cache, to use in offline mode
let fm = FileManager.iCloud();
let offlinePath = fm.joinPath(fm.documentsDirectory(), folder);
if (!fm.fileExists(offlinePath)) {
    fm.createDirectory(offlinePath);
}

// Get team data
let teamOverview;
try {
    teamOverview = await new Request(teamOverviewUrl).loadJSON();
    // If data successfully retrieved, write to cache
    fm.writeString(fm.joinPath(offlinePath, "teamOverview.json"), JSON.stringify(teamOverview));
} catch (err) {
    console.log("Team Overview " + err + " Trying to read cached data.");
    try {
        // If data not successfully retrieved, read from cache
        await fm.downloadFileFromiCloud(fm.joinPath(offlinePath, "teamOverview.json"));
        let raw = fm.readString(fm.joinPath(offlinePath, "teamOverview.json"));
        teamOverview = JSON.parse(raw);
    } catch (err) {
        console.log("Team Overview " + err);
    }
}
let leagueTable = teamOverview.tableData.tables[0].table;
let leagueTitle = teamOverview.tableData.tables[0].leagueName;
// If league table is not found assume it is a special case with more than one table available
if (!leagueTable) {
  let teamFound;
  let tableIndex = 0;
  for (let i = 0; i < teamOverview.tableData.tables[0].tables.length; i += 1) {
    teamFound = (teamOverview.tableData.tables[0].tables[i].table).findIndex(obj => obj.id == teamId);
    if (teamFound != -1) {
      tableIndex = i;
      break;
    }
  }
  leagueTable = teamOverview.tableData.tables[0].tables[tableIndex].table;
  leagueTitle = showLeagueSubtitle ? leagueTitle + " (" + teamOverview.tableData.tables[0].tables[tableIndex].leagueName + ") " : leagueTitle;
}

let leagueOverviewUrl = encodeURI(apiBaseUrl + teamOverview.tableData.tables[0].pageUrl);
let leagueTableUrl = leagueOverviewUrl.replace("overview", "table");
// Check if team is on league (in case we are using offline data and team configured is new)
let teamOnLeague = leagueTable[leagueTable.findIndex(obj => obj.id == teamId)];
let teamLeaguePosition = -1;
if (teamOnLeague != undefined) {
    // If team found in league get team position
    teamLeaguePosition = teamOnLeague.idx;
}
let teamFixtures = teamOverview.fixtures;
// Find next match (first match not started and not cancelled)
let nextFixtureIndex = teamFixtures.findIndex(obj => obj.notStarted && !obj.status.cancelled);
let nextFixture = teamFixtures[nextFixtureIndex];
// Assume previous match is the one before the next
let previousFixtureIndex = nextFixtureIndex - 1;
if (nextFixture == undefined) {
    // If no next match available season is over, previous match is the last of the season, if exists
    previousFixtureIndex = teamFixtures.length - 1;
}
let previousFixture = teamFixtures[previousFixtureIndex];

// Run
if (config.runsInWidget) {
    let widget = await createWidget();
    Script.setWidget(widget);
    Script.complete();
} else {
    // Run widget on Scriptable app
    let widget = await createWidget();
    Script.complete();
    await widget.presentMedium();
}

// Functions

// Create widget UI
async function createWidget() {
  let paddingLeft = 14;
  let paddingRight = 13;
  let paddingTop = 15.5;
  let paddingBottom = 16;
  // By default small widgets will show the Table View, in order to see the Matches View edit the widget and add "matches" in the Parameter box
  if (config.widgetFamily === "small") {
    showMatchesView = args.widgetParameter === "matches";
    showTableView = args.widgetParameter !== "matches";
    if (showMatchesView) {
      paddingLeft = 10;
      paddingRight = 10;
      paddingBottom = 20;
    } else {
      paddingLeft = 0;
      paddingRight = 0;
    }
  }

    let widget = new ListWidget();
    widget.backgroundColor = backgroundColor;
    // Use background image if available
    setWidgetBackground(widget, backgroundImage);
    widget.setPadding(paddingTop, paddingLeft, paddingBottom, paddingRight);

    const globalStack = widget.addStack();

    if(showMatchesView) {
      widget.url = teamFixturesUrl;
      await addWidgetMatches(globalStack);
    }

    if (showTableView) {
      widget.url = leagueTableUrl;
      await addWidgetTable(globalStack);
    }

    return widget;
}

// Create matches
async function addWidgetMatches(stack) {
  const matchesStack = stack.addStack();
  matchesStack.url = teamFixturesUrl;
  // Move Matches stack to the left
  stack.addSpacer();
  matchesStack.layoutVertically();
    matchesStack.addSpacer(1.5);
    await addWidgetMatch(matchesStack, previousFixture, "Previous");
    matchesStack.addSpacer(9.5);
    // Add title
    let title = dictionary.matchTitleNext;
    let titleStack = matchesStack.addStack();
    titleStack.addSpacer(2);
    let titleText = titleStack.addText(title.toUpperCase());
    titleText.textColor = Color.gray();
    titleText.font = Font.semiboldSystemFont(11);
    matchesStack.addSpacer(3);
    await addWidgetMatch(matchesStack, nextFixture, "Next");
}

// Create match
async function addWidgetMatch(stack, fixture, title) {
    stack.addSpacer(2);
    let eventStack = stack.addStack();
    eventStack.size = new Size(0, 46);
    // Set result color
    let colorStack = eventStack.addStack();
    // If match is in the future make it gray
    let eventColor = Color.gray();
    if (fixture != undefined) {
        eventStack.url = encodeURI(apiBaseUrl + fixture.pageUrl);
        let fixtureDetails;
        fixtureDetails = await getFixtureDetails(title, fixture.id);
        if (fixtureDetails.header.status.started) {
            if (fixture.home.score == fixture.away.score) {
                // If there is a draw make it yellow
                eventColor = Color.yellow();
            } else if ((fixtureDetails.header.teams[0].score > fixtureDetails.header.teams[1].score && fixture.home.id == teamId) ||
                (fixtureDetails.header.teams[0].score < fixtureDetails.header.teams[1].score && fixture.away.id == teamId)) {
                // If selected team is winning make it green
                eventColor = Color.green();
            } else {
                // If selected team is losing make it red
                eventColor = Color.red();
            }
        }
        // Draw left bar with result color
        let drawContext = new DrawContext();
        drawContext.size = new Size(10, 115);
        drawContext.respectScreenScale = true;
        drawContext.opaque = false;
        drawContext.setStrokeColor(eventColor);
        drawContext.setLineWidth(10);
        const path = new Path();
        path.move(new Point(5, 5));
        path.addLine(new Point(5, 110));
        drawContext.addPath(path);
        drawContext.strokePath();
        drawContext.setFillColor(eventColor);
        drawContext.fillEllipse(new Rect(0, 0, 10, 10));
        drawContext.fillEllipse(new Rect(0, 105, 10, 10));
        const testImage = drawContext.getImage();
        colorStack.addImage(testImage);
        eventStack.addSpacer(5);

        // Add event league information
        let textStack = eventStack.addStack();
        textStack.layoutVertically();
        let leagueStack = textStack.addStack();
        leagueStack.centerAlignContent();
        let leagueInfo = leagueStack.addText(shortenLeagueRound(fixtureDetails.content.matchFacts.infoBox.Tournament.text)[0]);
        leagueInfo.font = Font.semiboldSystemFont(13);
        leagueInfo.lineLimit = 1;
        if (showRound && shortenLeagueRound(fixtureDetails.content.matchFacts.infoBox.Tournament.text)[1]) {
          let roundInfo = leagueStack.addText(shortenLeagueRound(fixtureDetails.content.matchFacts.infoBox.Tournament.text)[1]);
          roundInfo.font = Font.semiboldSystemFont(13);
          roundInfo.lineLimit = 1;
        }
        textStack.addSpacer(1);

        // Add match info
        let matchStack = textStack.addStack();
        matchStack.centerAlignContent();
        let homeNameStack = matchStack.addStack();
        let homeName = homeNameStack.addText(replaceText(fixture.home.name));
        homeName.lineLimit = 1;
        homeName.font = Font.regularSystemFont(12);
        let separatorStack = matchStack.addStack();
        separatorStack.addSpacer(3);
        let separator = separatorStack.addText('-');
        separator.font = Font.regularSystemFont(12);
        separatorStack.addSpacer(3);
        let awayNameStack = matchStack.addStack();
        let awayName = awayNameStack.addText(replaceText(fixture.away.name));
        awayName.lineLimit = 1;
        awayName.font = Font.regularSystemFont(12);
        textStack.addSpacer(1);

        // Add date/time or result
        if (!fixtureDetails.header.status.started) {
          if (fixtureDetails.header.status.cancelled) {
            // If match is cancelled show reason
            let fullResultStack = textStack.addStack();
            fullResultStack.centerAlignContent();
            let resultStack = fullResultStack.addStack();
            let result = resultStack.addText(replaceText(fixtureDetails.header.status.reason.long));
            result.font = Font.regularSystemFont(12);
            result.textColor = Color.gray();
          } else {
            // If match is in the future show date and time
            let fullDateStack = textStack.addStack();
            fullDateStack.centerAlignContent();
            let dateStack = fullDateStack.addStack();
            let matchDate = dateStack.addText(formatDate(new Date(fixtureDetails.content.matchFacts.infoBox["Match Date"])));
            matchDate.font = Font.regularSystemFont(12);
            matchDate.textColor = Color.gray();
            dateStack.addSpacer(5);
            let timeStack = fullDateStack.addStack();
            let matchTime = timeStack.addText(formatTime(new Date(fixtureDetails.content.matchFacts.infoBox["Match Date"])));
            matchTime.font = Font.regularSystemFont(12);
            matchTime.textColor = Color.gray();
          }
        } else {
            // If match is in the past or ongoing show result
            let fullResultStack = textStack.addStack();
            fullResultStack.centerAlignContent();
            let resultStack = fullResultStack.addStack();
            let result = resultStack.addText(fixtureDetails.header.status.scoreStr);
            result.font = Font.regularSystemFont(12);
            result.textColor = Color.gray();
            resultStack.addSpacer(5);
            let outcomeStack = fullResultStack.addStack();
            if (fixtureDetails.header.status.started && !fixtureDetails.header.status.finished) {
              if (showLivetime) {
                let liveTime = outcomeStack.addText("(" + replaceText(fixtureDetails.header.status.liveTime.short) + ")");
                liveTime.font = Font.regularSystemFont(12);
                liveTime.textColor = Color.gray();
                outcomeStack.addSpacer(5);
            }
                // If match is ongoing add circle symbol
                let liveText = outcomeStack.addText("●");
                liveText.font = Font.semiboldSystemFont(11);
                liveText.textColor = liveColor;
            }
        }
    } else {
        // If there is no match let user know
        let textStack = eventStack.addStack();
        textStack.layoutVertically();
        let noDataStack = textStack.addStack();
        noDataStack.centerAlignContent();
        let noData = noDataStack.addText("No matches available");
        noData.lineLimit = 1;
        noData.font = Font.regularSystemFont(12);
        textStack.addSpacer(1);
        let space1 = textStack.addText("");
        space1.font = Font.semiboldSystemFont(13);
        textStack.addSpacer(1);
        let space2 = textStack.addText("");
        space2.font = Font.regularSystemFont(12);
    }
}

async function addWidgetTable(stack) {
  const tableFullStack = stack.addStack();
  tableFullStack.layoutVertically();
    tableFullStack.url = leagueTableUrl;
    // Add league title
    tableFullStack.addSpacer(2.5);
    const leagueLine = tableFullStack.addStack();
    leagueLine.addSpacer(4);
    let leagueTitleText = leagueLine.addText(leagueTitle.toUpperCase());
    leagueTitleText.textColor = leagueTitleColor;
    leagueTitleText.font = Font.semiboldSystemFont(11);
    leagueTitleText.lineLimit = 1;
    tableFullStack.addSpacer(1);

    // Add table
    const hSpacing = config.widgetFamily === "small" ? 17 : 19.2;
    const vSpacing = 18.4;
    const tableStack = tableFullStack.addStack();
    tableStack.spacing = 2;
    const tableInfo = getTable(leagueTable, teamLeaguePosition);
    const table = tableInfo[0];
    const highlighted = tableInfo[1];
    for (let i = 0; i < table.length; i += 1) {
        let rowStack = tableStack.addStack();
        rowStack.layoutVertically();
        for (let j = 0; j < table[i].length; j += 1) {
            let valueStack = rowStack.addStack();
            valueStack.size = new Size(hSpacing, vSpacing);
            valueStack.centerAlignContent();
            if (i == 0 && j == highlighted) {
                // Highlight selected team position on first column
                const highlightedPosition = getHighlightedPosition((teamLeaguePosition).toString(), positionColor);
                valueStack.addImage(highlightedPosition);
            } else if (i == 1 && j > 0) {
                // Show teams badges on second column
                let teamImg = await getTeamImg(j, table[i][j]);
                let teamImage = valueStack.addImage(teamImg);
                teamImage.imageSize = new Size(14, 14);
            } else {
                // Otherwise show table data normally
                let valueText = valueStack.addText(`${table[i][j]}`);
                valueText.font = Font.semiboldSystemFont(10);
                valueText.centerAlignText();
            }
        }
    }
}

// Build the league table (Position, Team, Matches Played, Wins, Draws, Losses, Points)
function getTable(leagueTable, teamLeaguePosition) {
    const table = [
        // Table header
        ["#"],
        [dictionary.tableHeaderTeam],
        [dictionary.tableHeaderPlayed],
        [dictionary.tableHeaderWins],
        [dictionary.tableHeaderDraws],
        [dictionary.tableHeaderLosses],
        [dictionary.tableHeaderPoints]
    ];
    const teamsToShow = Math.min(5, leagueTable.length);
    const teamsAbove = Math.ceil((teamsToShow - 1) / 2);
    const teamsBelow = Math.floor((teamsToShow - 1) / 2);
    // By default show 2 teams above selected team and 2 teams below selected team (5 rows in total)
    let initial = teamLeaguePosition - teamsAbove;
    let final = teamLeaguePosition + teamsBelow;
    // By default highlight selected team, in the middle row
    let highlighted = teamsToShow - teamsBelow;
      if (teamLeaguePosition == -1) {
          // If team selected not found show 5 top teams and do not highlight any
          initial = 1;
          final = initial + 4;
          highlighted = -1;
          console.log("League Table Error: Team not found in the selected league, showing top teams.");
        } else if (teamLeaguePosition <= teamsAbove) {
            // If team selected in first place show 5 top teams and highlight first row
            initial = 1;
            final = teamsToShow <= leagueTable.length ? teamsToShow : leagueTable.length;
            highlighted = teamLeaguePosition;
          } else if (teamLeaguePosition > leagueTable.length - teamsBelow) {
              // If team selected in first place show 5 top teams and highlight first row
              initial = leagueTable.length - teamsToShow >= 0 ? leagueTable.length - teamsToShow + 1 : 1;
              final = leagueTable.length;
              highlighted = teamLeaguePosition - initial + 1;
      }

    for (let i = initial; i < final + 1; i += 1) {
        // Add table data, row by row
        table[0].push(i);
        table[1].push(leagueTable[i - 1].id);
        table[2].push(leagueTable[i - 1].played);
        table[3].push(leagueTable[i - 1].wins);
        table[4].push(leagueTable[i - 1].draws);
        table[5].push(leagueTable[i - 1].losses);
        table[6].push(leagueTable[i - 1].pts);
    }
    return [table, highlighted];
}

// Return the team badge
async function getTeamImg(position, id) {
    // Set image URL, using xsmall images
    let imageUrl = encodeURI(apiBaseUrl + "/images/team/" + id + "_xsmall");
    let image;
    try {
        image = await new Request(imageUrl).loadImage();
        // If image successfully retrieved, write to cache
        fm.writeImage(fm.joinPath(offlinePath, "badge_" + position + ".png"), image);
    } catch (err) {
        console.log("Badge Image " + err + " Trying to read cached data.");
        try {
            // If image not successfully retrieved, read from cache
            await fm.downloadFileFromiCloud(fm.joinPath(offlinePath, "badge_" + position + ".png"));
            image = fm.readImage(fm.joinPath(offlinePath, "badge_" + position + ".png"));
        } catch (err) {
            console.log("Badge Image " + err);
        }
    }
    return image;
}

// Draws a circle on the team current position in the league table
function getHighlightedPosition(position, color) {
    const drawing = new DrawContext();
    drawing.respectScreenScale = true;
    const size = 50;
    drawing.size = new Size(size, size);
    drawing.opaque = false;
    drawing.setFillColor(color);
    drawing.fillEllipse(new Rect(1, 1, size - 2, size - 2));
    drawing.setFont(Font.semiboldSystemFont(27));
    drawing.setTextAlignedCenter();
    drawing.setTextColor(new Color("#ffffff"));
    drawing.drawTextInRect(position, new Rect(0, 8.5, size, size));
    const currentDayImg = drawing.getImage();
    return currentDayImg;
}

// Get additional fixture information
async function getFixtureDetails(title, fixtureId) {
    let fixtureDetails;
    try {
        fixtureDetails = await new Request(fixtureDetailsUrl + fixtureId).loadJSON();
        // If data successfully retrieved, write to cache (always using English title for file name, to avoid duplicate cached data for different languages)
        fm.writeString(fm.joinPath(offlinePath, "fixture" + title + ".json"), JSON.stringify(fixtureDetails));
    } catch (err) {
        console.log(title + " Fixture Details " + err + " Trying to read cached data.");
        try {
            // If data not successfully retrieved, read from cache
            await fm.downloadFileFromiCloud(fm.joinPath(offlinePath, "fixture" + title + ".json"));
            let raw = fm.readString(fm.joinPath(offlinePath, "fixture" + title + ".json"));
            fixtureDetails = JSON.parse(raw);
        } catch (err) {
            console.log(title + " Fixture Details " + err);
        }
    }
    return fixtureDetails;
}

// Formats the event date into day and month (format 01/Jan)
function formatDate(date) {
    if (isToday(date)) {
        return dictionary.matchDateToday;
    } else if (isTomorrow(date)) {
        return dictionary.matchDateTomorrow;
    } else {
        let dateFormatter = new DateFormatter();
        dateFormatter.dateFormat = "dd/MMM";
        // Format will depend on device language
        dateFormatter.locale = (preferredLanguage);
        return dateFormatter.string(date);
    }
}

function formatTime(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  minutes = minutes < 10 ? '0' + minutes : minutes;
  var time;
  if (twelveHourClock) {
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    time = hours + ':' + minutes + ampm;
  }
  else {
    time = hours + ':' + minutes;
  }
  return time;
}

// Check if date is today
function isToday(date) {
    const today = new Date();
    return (date.getDate() == today.getDate() &&
        date.getMonth() == today.getMonth() &&
        date.getFullYear() == today.getFullYear());
}

// Check if date is tomorrow
function isTomorrow(date) {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return (date.getDate() == tomorrow.getDate() &&
        date.getMonth() == tomorrow.getMonth() &&
        date.getFullYear() == tomorrow.getFullYear());
}

// Look for backgroundImage in folder and if available use it as background
function setWidgetBackground(widget, backgroundImage) {
    const imageUrl = fm.joinPath(offlinePath, backgroundImage);
    widget.backgroundImage = Image.fromFile(imageUrl);
}

// Prepare league and round name to fit in widget
function shortenLeagueRound(leagueRoundName) {
    // Clean extra spaces found on FotMob API responses
    leagueRoundName = leagueRoundName.replace(/ +(?= )/g, '');
    // Split League and Round information
    let leagueName = leagueRoundName.split(" - ")[0];
    let roundName = leagueRoundName.split(" - ")[1];
    if (roundName) {
      // Clean up round name
      if (roundName.includes("Round")) {
          if (roundName.includes("of")) {
              // Replace "Round of X" with "1/X"
              roundName = "1/" + roundName.split("Round of ")[1];
          } else {
              // Replace "Round X" with "RX" (language dependent)
              roundName = dictionary.matchRound + roundName.split("Round ")[1];
          }
      }
      return [replaceText(leagueName), " (" + replaceText(roundName) + ")"];
    } else {
      return [replaceText(leagueName), false];
    }
}

// Shorten and / or translate specific information
function replaceText(string) {
    let text = {
        // Tournaments
        "Champions League Qualification": dictionary.championsLeagueQualification,
        "Europa League Qualification": dictionary.europaLeagueQualification,
        "Cup": dictionary.cup,
        "League Cup": dictionary.leagueCup,
        "Super Cup": dictionary.superCup,
        "Club Friendlies": dictionary.clubFriendlies,
        // Rounds
        "Quarter-Final": dictionary.quarterFinal,
        "Semi-Final": dictionary.semiFinal,
        "Final": dictionary.final,
        // Cancel reasons
        "Postponed": dictionary.postponed,
        "Cancelled": dictionary.cancelled,
        //Live time
        "HT": dictionary.halfTime,
        // Teams
        "Sporting CP": "Sporting",
        "Famalicao": "Famalicão",
        "Pacos de Ferreira": "P. Ferreira",
        "Vitoria de Guimaraes": "V. Guimarães",
        "Belenenses SAD": "Belenenses",
        "FC Porto": "Porto"
    }
    if (text[string]) {
        return text[string];
        // Special cases - includes
    } else if (string.includes("Champions League")) {
        return dictionary.championsLeague;
    } else if (string.includes("Europa League")) {
        return dictionary.europaLeague;
    } else if (string.includes("UEFA Super Cup")) {
        return dictionary.uefaSuperCup;
    } else {
        return string;
    }
}

// Multi language dictionary
function getDictionary(lang) {
    let text = {
        en: {
            championsLeague: "Champions League",
            championsLeagueQualification: "Champions League Q.",
            europaLeague: "Europa League",
            europaLeagueQualification: "Europa League Q.",
            uefaSuperCup: "UEFA Super Cup",
            cup: "Cup",
            leagueCup: "League Cup",
            superCup: "Super Cup",
            clubFriendlies: "Friendly",
            quarterFinal: "QF",
            semiFinal: "SF",
            final: "F",
            matchTitleNext: "Next",
            matchRound: "R",
            matchDateToday: "Today",
            matchDateTomorrow: "Tomorrow",
            postponed: "Postponed",
            cancelled: "Cancelled",
            halfTime: "HT",
            tableHeaderTeam: "T",
            tableHeaderPlayed: "M",
            tableHeaderWins: "W",
            tableHeaderDraws: "D",
            tableHeaderLosses: "L",
            tableHeaderPoints: "P"
        },
        pt: {
            championsLeague: "Liga Campeões",
            championsLeagueQualification: "Q. Liga Campeões",
            europaLeague: "Liga Europa",
            europaLeagueQualification: "Q. Liga Europa",
            uefaSuperCup: "Supertaça Europeia",
            cup: "Taça",
            leagueCup: "Taça Liga",
            superCup: "Supertaça",
            clubFriendlies: "Amigável",
            quarterFinal: "QF",
            semiFinal: "MF",
            final: "F",
            matchTitleNext: "Próximo",
            matchRound: "J",
            matchDateToday: "Hoje",
            matchDateTomorrow: "Amanhã",
            postponed: "Adiado",
            cancelled: "Cancelado",
            halfTime: "Int",
            tableHeaderTeam: "E",
            tableHeaderPlayed: "J",
            tableHeaderWins: "V",
            tableHeaderDraws: "E",
            tableHeaderLosses: "D",
            tableHeaderPoints: "P"
        },
        fr: {
            championsLeague: "Ligue Champions",
            championsLeagueQualification: "Q. Ligue Champions",
            europaLeague: "Ligue Europa",
            europaLeagueQualification: "Q. Ligue Europa",
            uefaSuperCup: "Supercoupe d'Europe",
            cup: "Coupe",
            leagueCup: "League Cup",
            superCup: "Supercoupe",
            clubFriendlies: "Amical",
            quarterFinal: "QF",
            semiFinal: "DF",
            final: "F",
            matchTitleNext: "Suivant",
            matchRound: "J",
            matchDateToday: "Aujourd'hui",
            matchDateTomorrow: "Demain",
            postponed: "Reporté",
            cancelled: "Annulé",
            halfTime: "MT",
            tableHeaderTeam: "C",
            tableHeaderPlayed: "M",
            tableHeaderWins: "G",
            tableHeaderDraws: "N",
            tableHeaderLosses: "P",
            tableHeaderPoints: "PT"
        },
        de: {
            championsLeague: "Champions League",
            championsLeagueQualification: "Champions League Q.",
            europaLeague: "Europa League",
            europaLeagueQualification: "Europa League Q.",
            uefaSuperCup: "UEFA Supercup",
            cup: "DFB-Pokal",
            leagueCup: "Ligapokal",
            superCup: "Supercup",
            clubFriendlies: "Testspiel",
            quarterFinal: "VF",
            semiFinal: "HF",
            final: "F",
            matchTitleNext: "Nächstes",
            matchRound: "S",
            matchDateToday: "Heute",
            matchDateTomorrow: "Morgen",
            postponed: "Verlegt",
            cancelled: "Abgesagt",
            halfTime: "HZ",
            tableHeaderTeam: "M",
            tableHeaderPlayed: "S",
            tableHeaderWins: "G",
            tableHeaderDraws: "U",
            tableHeaderLosses: "V",
            tableHeaderPoints: "P"
        }
    };
    return text[lang];
}
