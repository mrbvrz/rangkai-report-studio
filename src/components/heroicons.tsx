import type { ComponentType, SVGProps } from "react";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpTrayIcon,
  Bars3Icon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  DocumentArrowDownIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon,
  FolderIcon,
  FolderOpenIcon,
  FunnelIcon,
  KeyIcon,
  ListBulletIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PencilIcon,
  PhotoIcon,
  PlusIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type Props = SVGProps<SVGSVGElement> & { size?: number | string };
const wrap =
  (Icon: ComponentType<SVGProps<SVGSVGElement>>) =>
  ({ size = 20, ...props }: Props) => (
    <Icon {...props} width={size} height={size} />
  );

export const ArrowDownTray = wrap(ArrowDownTrayIcon);
export const ArrowLeft = wrap(ArrowLeftIcon);
export const ArrowPath = wrap(ArrowPathIcon);
export const ArrowRight = wrap(ArrowRightIcon);
export const ArrowUpTray = wrap(ArrowUpTrayIcon);
export const Bars3 = wrap(Bars3Icon);
export const BookOpen = wrap(BookOpenIcon);
export const CalendarDays = wrap(CalendarDaysIcon);
export const ChartBar = wrap(ChartBarIcon);
export const Check = wrap(CheckIcon);
export const CheckCircle = wrap(CheckCircleIcon);
export const ChevronDown = wrap(ChevronDownIcon);
export const ChevronLeft = wrap(ChevronLeftIcon);
export const ChevronRight = wrap(ChevronRightIcon);
export const CircleStack = wrap(CircleStackIcon);
export const CodeBracket = wrap(CodeBracketIcon);
export const Cog6Tooth = wrap(Cog6ToothIcon);
export const DocumentArrowDown = wrap(DocumentArrowDownIcon);
export const DocumentCheck = wrap(DocumentCheckIcon);
export const DocumentText = wrap(DocumentTextIcon);
export const Eye = wrap(EyeIcon);
export const EyeSlash = wrap(EyeSlashIcon);
export const Folder = wrap(FolderIcon);
export const FolderOpen = wrap(FolderOpenIcon);
export const Funnel = wrap(FunnelIcon);
export const Key = wrap(KeyIcon);
export const ListBullet = wrap(ListBulletIcon);
export const LockClosed = wrap(LockClosedIcon);
export const MagnifyingGlass = wrap(MagnifyingGlassIcon);
export const PaperAirplane = wrap(PaperAirplaneIcon);
export const Pencil = wrap(PencilIcon);
export const Photo = wrap(PhotoIcon);
export const Plus = wrap(PlusIcon);
export const RectangleStack = wrap(RectangleStackIcon);
export const ShieldCheck = wrap(ShieldCheckIcon);
export const Sparkles = wrap(SparklesIcon);
export const Squares2X2 = wrap(Squares2X2Icon);
export const Trash = wrap(TrashIcon);
export const XCircle = wrap(XCircleIcon);
export const XMark = wrap(XMarkIcon);

export const BarChart3 = ChartBar;
export const Braces = CodeBracket;
export const BookOpenText = BookOpen;
export const CalendarRange = CalendarDays;
export const CheckCircle2 = CheckCircle;
export const DatabaseBackup = CircleStack;
export const Download = ArrowDownTray;
export const FileClock = DocumentCheck;
export const FileDown = DocumentArrowDown;
export const FileImage = Photo;
export const FileStack = RectangleStack;
export const FileText = DocumentText;
export const FileUp = ArrowUpTray;
export const Filter = Funnel;
export const FolderKanban = Folder;
export const FolderSync = ArrowPath;
export const Grid3X3 = Squares2X2;
export const Image = Photo;
export const ImagePlus = Photo;
export const KeyRound = Key;
export const List = ListBullet;
export const Loader2 = ArrowPath;
export const LockKeyhole = LockClosed;
export const Menu = Bars3;
export const RefreshCw = ArrowPath;
export const Save = ArrowDownTray;
export const Search = MagnifyingGlass;
export const Send = PaperAirplane;
export const Settings2 = Cog6Tooth;
export const Trash2 = Trash;
export const WandSparkles = Sparkles;
export const X = XMark;
