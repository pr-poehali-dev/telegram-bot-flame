import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const API_URL = 'https://functions.poehali.dev/a68834b0-14fc-4238-aca5-62fc7336a967';

interface User {
  id: number;
  telegram_id: number;
  username: string;
  first_name: string;
}

interface Streak {
  id: number;
  current_streak: number;
  last_activity_date: string;
  status: string;
  restore_count: number;
  user1_username: string;
  user1_name: string;
  user2_username: string;
  user2_name: string;
  unread_count: number;
}

export default function Index() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [view, setView] = useState<'register' | 'main' | 'invite'>('register');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedStreak, setSelectedStreak] = useState<Streak | null>(null);

  const registerUser = async () => {
    if (!username || !firstName) {
      toast.error('Заполните все поля');
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          telegram_id: Math.floor(Math.random() * 1000000000),
          username: username,
          first_name: firstName
        })
      });

      const data = await response.json();
      
      if (data.status === 'registered' || data.status === 'already_registered') {
        setCurrentUser(data.user);
        setView('main');
        loadStreaks(data.user.telegram_id);
        toast.success('Добро пожаловать! 🔥');
      }
    } catch (error) {
      toast.error('Ошибка регистрации');
    }
  };

  const loadStreaks = async (telegramId: number) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_streaks',
          telegram_id: telegramId
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        setStreaks(data.streaks || []);
      }
    } catch (error) {
      console.error('Error loading streaks:', error);
    }
  };

  const inviteUser = async () => {
    if (!inviteUsername || !currentUser) return;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          inviter_telegram_id: currentUser.telegram_id,
          invitee_username: inviteUsername
        })
      });

      const data = await response.json();
      
      if (data.error) {
        toast.error(data.error);
      } else if (data.status === 'invite_sent') {
        toast.success('Приглашение отправлено! 🔥');
        setInviteUsername('');
        setView('main');
        
        if (currentUser) {
          await acceptInvite(data.streak.id);
        }
      }
    } catch (error) {
      toast.error('Ошибка отправки приглашения');
    }
  };

  const acceptInvite = async (streakId: number) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_invite',
          streak_id: streakId
        })
      });

      const data = await response.json();
      
      if (data.status === 'accepted' && currentUser) {
        loadStreaks(currentUser.telegram_id);
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
    }
  };

  const sendMessage = async (streakId: number) => {
    if (!messageText || !currentUser) return;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          streak_id: streakId,
          sender_telegram_id: currentUser.telegram_id,
          message_text: messageText
        })
      });

      const data = await response.json();
      
      if (data.status === 'message_sent') {
        toast.success('Огонёк продолжается! 🔥');
        setMessageText('');
        loadStreaks(currentUser.telegram_id);
      }
    } catch (error) {
      toast.error('Ошибка отправки сообщения');
    }
  };

  const restoreStreak = async (streakId: number) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_streak',
          streak_id: streakId
        })
      });

      const data = await response.json();
      
      if (data.error) {
        toast.error(data.error);
      } else if (data.status === 'restored') {
        toast.success(`Огонёк восстановлен! Осталось ${data.restores_left} восстановлений 🔥`);
        if (currentUser) {
          loadStreaks(currentUser.telegram_id);
        }
      }
    } catch (error) {
      toast.error('Ошибка восстановления');
    }
  };

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 shadow-2xl animate-fade-in">
          <CardHeader className="text-center space-y-2">
            <div className="text-6xl mb-4 animate-pulse">🔥</div>
            <CardTitle className="text-3xl font-bold">Огоньки</CardTitle>
            <CardDescription className="text-base">
              Поддерживай общение с друзьями каждый день!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Имя пользователя</label>
              <Input
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ваше имя</label>
              <Input
                placeholder="Иван"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="border-2"
              />
            </div>
            <Button
              onClick={registerUser}
              className="w-full text-lg h-12 font-semibold"
              size="lg"
            >
              Начать 🚀
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'invite') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10 p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <Button
            variant="ghost"
            onClick={() => setView('main')}
            className="mb-4"
          >
            <Icon name="ArrowLeft" size={20} className="mr-2" />
            Назад
          </Button>

          <Card className="border-2 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="UserPlus" size={24} />
                Пригласить друга
              </CardTitle>
              <CardDescription>
                Введите username пользователя Telegram
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username друга</label>
                <Input
                  placeholder="friend_username"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="border-2"
                />
              </div>
              <Button
                onClick={inviteUser}
                className="w-full text-lg h-12 font-semibold"
                size="lg"
              >
                Отправить приглашение 🔥
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10 pb-20">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 pt-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              🔥 Огоньки
            </h1>
            <p className="text-muted-foreground">
              Привет, {currentUser?.first_name}!
            </p>
          </div>
          <Button
            onClick={() => setView('invite')}
            size="lg"
            className="font-semibold"
          >
            <Icon name="UserPlus" size={20} className="mr-2" />
            Пригласить
          </Button>
        </div>

        {selectedStreak ? (
          <Card className="border-2 shadow-xl mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedStreak(null)}
                  size="sm"
                >
                  <Icon name="ArrowLeft" size={20} className="mr-2" />
                  Назад
                </Button>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  🔥 {selectedStreak.current_streak} дней
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-8 bg-secondary/30 rounded-lg">
                <div className="text-6xl mb-4">🔥</div>
                <p className="text-2xl font-bold mb-2">
                  Ваша серия длится:
                </p>
                <p className="text-4xl font-bold text-primary">
                  {selectedStreak.current_streak} {selectedStreak.current_streak === 1 ? 'день' : 'дней'}
                </p>
                {selectedStreak.unread_count > 0 && (
                  <Badge variant="destructive" className="mt-4">
                    Непрочитанное сообщение
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Отправить сообщение</label>
                <Input
                  placeholder="Напишите что-нибудь..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="border-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && messageText) {
                      sendMessage(selectedStreak.id);
                    }
                  }}
                />
              </div>
              <Button
                onClick={() => sendMessage(selectedStreak.id)}
                className="w-full text-lg h-12 font-semibold"
                size="lg"
                disabled={!messageText}
              >
                Отправить 🔥
              </Button>

              {selectedStreak.restore_count < 3 && (
                <Button
                  onClick={() => restoreStreak(selectedStreak.id)}
                  variant="outline"
                  className="w-full"
                >
                  Восстановить огонёк ({3 - selectedStreak.restore_count} осталось)
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {streaks.length === 0 ? (
              <Card className="border-2 shadow-xl text-center p-12">
                <div className="text-6xl mb-4">🔥</div>
                <p className="text-xl text-muted-foreground mb-4">
                  У вас пока нет огоньков
                </p>
                <p className="text-sm text-muted-foreground">
                  Пригласите друга, чтобы начать серию!
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold mb-4">Мои огоньки</h2>
                {streaks.map((streak) => {
                  const friendName =
                    streak.user1_username === currentUser?.username
                      ? streak.user2_name
                      : streak.user1_name;
                  const friendUsername =
                    streak.user1_username === currentUser?.username
                      ? streak.user2_username
                      : streak.user1_username;

                  return (
                    <Card
                      key={streak.id}
                      className="border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-[1.02]"
                      onClick={() => setSelectedStreak(streak)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">👤</div>
                            <div>
                              <p className="font-semibold text-lg">{friendName}</p>
                              <p className="text-sm text-muted-foreground">
                                @{friendUsername}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {streak.unread_count > 0 && (
                              <Badge variant="destructive">
                                {streak.unread_count}
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-lg px-3 py-1"
                            >
                              🔥 {streak.current_streak}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
