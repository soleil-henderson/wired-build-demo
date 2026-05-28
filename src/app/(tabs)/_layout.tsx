import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      className={`text-[10px] font-semibold ${focused ? 'text-accent' : 'text-ink-300'}`}
      numberOfLines={1}
    >
      {label.toUpperCase()}
    </Text>
  );
}

function TabDot({ focused }: { focused: boolean }) {
  return (
    <View
      className={`mt-1 h-1.5 w-1.5 rounded-full ${focused ? 'bg-accent' : 'bg-transparent'}`}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#0E1014',
          borderTopColor: '#1D2129',
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabLabel label="Feed" focused={focused} />
              <TabDot focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabLabel label="Explore" focused={focused} />
              <TabDot focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabLabel label="Log" focused={focused} />
              <TabDot focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'Garage',
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabLabel label="Garage" focused={focused} />
              <TabDot focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View className="items-center">
              <TabLabel label="Profile" focused={focused} />
              <TabDot focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
