// 전달받은 영상 번호로 팬 재생 함수를 호출하는 코드
// 빌드하면 FanController.exe 생김 

using System;

namespace FanController
{
    class Program
    {
        static void Main(string[] args)
        {
            Fan fan = new Fan();

            if (args.Length > 0)
            {
                fan.PlayVideoWithId(args[0]);
            }
        }
    }
}
