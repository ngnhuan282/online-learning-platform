import ArrowForward from '@mui/icons-material/ArrowForward';
import Search from '@mui/icons-material/Search';
import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import Terminal from '@mui/icons-material/Terminal';
import Web from '@mui/icons-material/Web';
import Storage from '@mui/icons-material/Storage';
import PsychologyOutlined from '@mui/icons-material/PsychologyOutlined';
import CloudOutlined from '@mui/icons-material/CloudOutlined';
import Translate from '@mui/icons-material/Translate';
import ViewKanbanOutlined from '@mui/icons-material/ViewKanbanOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import Devices from '@mui/icons-material/Devices';
import Insights from '@mui/icons-material/Insights';
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined';
import AccessTime from '@mui/icons-material/AccessTime';
import SignalCellularAlt from '@mui/icons-material/SignalCellularAlt';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import Close from '@mui/icons-material/Close';
import Menu from '@mui/icons-material/Menu';
import Language from '@mui/icons-material/Language';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import VolumeUpOutlined from '@mui/icons-material/VolumeUpOutlined';
import Fullscreen from '@mui/icons-material/Fullscreen';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import MicNone from '@mui/icons-material/MicNone';
import GraphicEq from '@mui/icons-material/GraphicEq';
import RecordVoiceOverOutlined from '@mui/icons-material/RecordVoiceOverOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import BusinessCenterOutlined from '@mui/icons-material/BusinessCenterOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import HeadsetMicOutlined from '@mui/icons-material/HeadsetMicOutlined';
import Tune from '@mui/icons-material/Tune';

const icons = {
  arrow: ArrowForward,
  search: Search,
  cap: SchoolOutlined,
  bell: NotificationsNone,
  code: Terminal,
  frontend: Web,
  database: Storage,
  brain: PsychologyOutlined,
  cloud: CloudOutlined,
  language: Translate,
  project: ViewKanbanOutlined,
  palette: PaletteOutlined,
  shield: VerifiedUserOutlined,
  devices: Devices,
  chart: Insights,
  bot: SmartToyOutlined,
  clock: AccessTime,
  level: SignalCellularAlt,
  play: PlayArrowRounded,
  check: CheckRounded,
  close: Close,
  menu: Menu,
  globe: Language,
  community: ForumOutlined,
  volume: VolumeUpOutlined,
  expand: Fullscreen,
  settings: SettingsOutlined,
};

export default function Icon({ name, size = 20, className = '' }) {
  const englishIcons = {
    mic: MicNone,
    wave: GraphicEq,
    speaking: RecordVoiceOverOutlined,
    assignment: AssignmentOutlined,
    business: BusinessCenterOutlined,
    book: MenuBookOutlined,
    headset: HeadsetMicOutlined,
    tune: Tune,
  };
  const Component = englishIcons[name] || icons[name] || SchoolOutlined;
  return <Component className={`icon ${className}`} style={{ fontSize: size }} aria-hidden="true" />;
}
