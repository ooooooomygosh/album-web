// Test-only desktop composition capture. Never mutates Explorer or other windows.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
class DesktopPixels {
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int left, top, right, bottom; }
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd,out RECT rect);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hwnd,out RECT rect);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder cls,int length);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd,IntPtr dc,uint flags);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  static string Class(IntPtr h) { var s=new StringBuilder(256);GetClassName(h,s,256);return s.ToString(); }
  static double Number(string s) { return double.Parse(s,CultureInfo.InvariantCulture); }
  static int Main(string[] args) {
    try {
      SetProcessDpiAwarenessContext(new IntPtr(-4));
      var window=new IntPtr(long.Parse(args[0]));uint pid;GetWindowThreadProcessId(window,out pid);
      if(pid!=uint.Parse(args[1])||Class(window)!="Chrome_WidgetWin_1")throw new Exception("Not an owned test window");
      var parent=GetParent(window);var cls=Class(parent);if(cls!="Progman"&&cls!="WorkerW")throw new Exception("Not a desktop child");
      RECT desktop,bounds,client;GetWindowRect(parent,out desktop);GetWindowRect(window,out bounds);GetClientRect(window,out client);
      var clip=new Rectangle(bounds.left-desktop.left+(int)Math.Round(Number(args[3])*(bounds.right-bounds.left)),bounds.top-desktop.top+(int)Math.Round(Number(args[4])*(bounds.bottom-bounds.top)),(int)Math.Round(Number(args[5])*(bounds.right-bounds.left)),(int)Math.Round(Number(args[6])*(bounds.bottom-bounds.top)));
      using(var frame=new Bitmap(desktop.right-desktop.left,desktop.bottom-desktop.top)) {
        using(var graphics=Graphics.FromImage(frame)) {var dc=graphics.GetHdc();try{if(!PrintWindow(parent,dc,2))throw new Exception("Desktop composition capture failed");}finally{graphics.ReleaseHdc(dc);}}
        using(var crop=frame.Clone(clip,PixelFormat.Format32bppArgb)) {
          crop.Save(args[2],ImageFormat.Png);
          var colours=new HashSet<int>();for(int y=0;y<crop.Height;y+=2)for(int x=0;x<crop.Width;x+=2)colours.Add(crop.GetPixel(x,y).ToArgb());
          var report=new Dictionary<string,object>{{"source","Windows desktop parent composition"},{"width",crop.Width},{"height",crop.Height},{"distinctColours",colours.Count},{"clientWidth",client.right},{"clientHeight",client.bottom},{"windowWidth",bounds.right-bounds.left},{"windowHeight",bounds.bottom-bounds.top}};
          if(args.Length>7)using(var reference=new Bitmap(args[7])) {
            if(reference.Width!=crop.Width||reference.Height!=crop.Height)throw new Exception("Reference size mismatch");
            long total=0,diff=0,close=0;for(int y=0;y<crop.Height;y++)for(int x=0;x<crop.Width;x++){var a=crop.GetPixel(x,y);var b=reference.GetPixel(x,y);int d=Math.Abs(a.R-b.R)+Math.Abs(a.G-b.G)+Math.Abs(a.B-b.B);diff+=d;total++;if(d<=45)close++;}
            report["matchingPixelFraction"]=(double)close/total;report["meanChannelDifference"]=(double)diff/(total*3);
          }
          Console.WriteLine(new JavaScriptSerializer().Serialize(report));
        }
      }
      return 0;
    } catch(Exception error) {Console.Error.WriteLine(error.Message);return 1;}
  }
}
