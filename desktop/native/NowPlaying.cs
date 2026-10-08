// Reads the Windows system media session (SMTC), the same source as the
// volume flyout, so any player that publishes it (Spotify, NetEase Cloud
// Music, QQ Music, browsers) can be shown. Prints one JSON line per change and
// accepts play/pause/toggle/next/previous on stdin. Exits when stdin closes.
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Windows.Media.Control;
using Windows.Storage.Streams;

class NowPlaying {
  static GlobalSystemMediaTransportControlsSessionManager manager;
  static string artworkKey = "", artwork = "";

  static void Main() {
    Console.OutputEncoding = new UTF8Encoding(false);
    try { manager = GlobalSystemMediaTransportControlsSessionManager.RequestAsync().AsTask().Result; }
    catch { Console.WriteLine("{\"available\":false}"); return; }
    new Thread(ReadCommands) { IsBackground = true }.Start();
    string last = "";
    while (true) {
      string json;
      try { json = Snapshot(); } catch { json = "{\"available\":true,\"active\":false}"; }
      if (json != last) { Console.WriteLine(json); Console.Out.Flush(); last = json; }
      Thread.Sleep(1000);
    }
  }

  static void ReadCommands() {
    string line;
    while ((line = Console.ReadLine()) != null) {
      try {
        var session = manager.GetCurrentSession();
        if (session == null) continue;
        switch (line.Trim()) {
          case "play": session.TryPlayAsync().AsTask().Wait(3000); break;
          case "pause": session.TryPauseAsync().AsTask().Wait(3000); break;
          case "toggle": session.TryTogglePlayPauseAsync().AsTask().Wait(3000); break;
          case "next": session.TrySkipNextAsync().AsTask().Wait(3000); break;
          case "previous": session.TrySkipPreviousAsync().AsTask().Wait(3000); break;
        }
      } catch { /* The player may refuse a command; the next snapshot shows the truth. */ }
    }
    Environment.Exit(0);
  }

  static string Snapshot() {
    var data = new Dictionary<string, object>();
    data["available"] = true;
    var session = manager.GetCurrentSession();
    if (session == null) { data["active"] = false; return new JavaScriptSerializer().Serialize(data); }
    var props = session.TryGetMediaPropertiesAsync().AsTask().Result;
    var info = session.GetPlaybackInfo();
    var timeline = session.GetTimelineProperties();
    data["active"] = true;
    data["app"] = session.SourceAppUserModelId ?? "";
    data["title"] = props.Title ?? "";
    data["artist"] = props.Artist ?? "";
    data["album"] = props.AlbumTitle ?? "";
    data["albumArtist"] = props.AlbumArtist ?? "";
    data["playing"] = info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
    data["position"] = timeline.Position.TotalSeconds;
    data["duration"] = (timeline.EndTime - timeline.StartTime).TotalSeconds;
    string key = props.Title + "\u0001" + props.Artist + "\u0001" + props.AlbumTitle;
    if (key != artworkKey) { artworkKey = key; artwork = ReadArtwork(props.Thumbnail); }
    data["artwork"] = artwork;
    return new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 }.Serialize(data);
  }

  static string ReadArtwork(IRandomAccessStreamReference reference) {
    if (reference == null) return "";
    try {
      using (var stream = reference.OpenReadAsync().AsTask().Result) {
        if (stream.Size == 0 || stream.Size > 200 * 1024) return "";
        uint size = (uint)stream.Size;
        var reader = new DataReader(stream.GetInputStreamAt(0));
        reader.LoadAsync(size).AsTask().Wait(3000);
        var bytes = new byte[size];
        reader.ReadBytes(bytes);
        string type = stream.ContentType;
        if (type != "image/png" && type != "image/jpeg") type = "image/jpeg";
        return "data:" + type + ";base64," + Convert.ToBase64String(bytes);
      }
    } catch { return ""; }
  }
}
