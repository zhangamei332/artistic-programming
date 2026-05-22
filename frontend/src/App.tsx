import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppLayout } from './components/layout/AppLayout';

const themeConfig = {
  token: {
    colorPrimary: '#4A90D9',
    borderRadius: 8,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
  },
};

function App() {
  return (
    <ConfigProvider theme={themeConfig} locale={zhCN}>
      <AppLayout />
    </ConfigProvider>
  );
}

export default App;
