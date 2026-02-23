// 팬 WiFi에 TCP로 "몇 번 영상 틀어라" 명령을 보내는 코드
// 1. 영상 번호 받음
// 2. 팬 프로토콜 명령어로 변환
// 3. WiFi TCP로 팬에 전송
// 4. 팬이 해당 BIN 실행

// 파일명에 붙은 숫자(슬롯 번호)를 기준으로 재생한다.
// 팬은 내부적으로 이런 구조로 봄:
// 명령값   실행되는 파일
// 01      1.BIN
// 111     111.BIN

using System;
using System.Net.Sockets;
using System.Text;

namespace FanController
{
    public class Fan
    {
        public static String DEFUALT_SERVER_IP = "192.168.4.1";
        public static int DEFUALT_SERVER_PORT = 5233;

        public string PlayVideoWithId(string videoID) // 만약 fan.PlayVideoWithId("1");로 호출됐다면
        {
            string id = videoID.PadLeft(2, '0'); // 두 자리 숫자로 맞춤 -> "01"

            string command = // 팬 제조사가 정해 놓은 고정 명령 패턴
                "c0eeb7c9baa3020000000014cc40lfj"
                + id +
                "bfb5d2a2";

            return Connect(command);
        }

        private static string Connect(string message)
        {
            try
            {
                TcpClient client = new TcpClient(DEFUALT_SERVER_IP, DEFUALT_SERVER_PORT); // TCP로 팬(192.168.4.1:5233)에 접속
                byte[] data = Encoding.ASCII.GetBytes(message);

                NetworkStream stream = client.GetStream();
                stream.Write(data, 0, data.Length); // 명령어(ASCII 문자열) 전송 -> 팬은 문자열 읽고 해당 번호 BIN 파일 실행

                // 한 번 명령 보내고 바로 끊는 구조
                stream.Close();
                client.Close();

                return "OK";
            }
            catch (Exception e)
            {
                return e.Message;
            }
        }
    }
}
