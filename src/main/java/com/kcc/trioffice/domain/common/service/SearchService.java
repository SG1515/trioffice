package com.kcc.trioffice.domain.common.service;


import com.kcc.trioffice.domain.chat_room.mapper.ChatRoomMapper;
import com.kcc.trioffice.domain.common.domain.SearchChatRoom;
import com.kcc.trioffice.domain.common.mapper.SearchMapper;
import com.kcc.trioffice.domain.employee.dto.response.EmployeeInfo;
import com.kcc.trioffice.domain.employee.dto.response.SearchEmployee;
import com.kcc.trioffice.domain.employee.mapper.EmployeeMapper;
import com.kcc.trioffice.domain.participation_employee.mapper.ParticipationEmployeeMapper;
import com.kcc.trioffice.global.exception.type.NotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

import static com.kcc.trioffice.global.constant.GlobalConstants.DEFAULT_GROUP_IMAGE;

@Service
@Slf4j
@RequiredArgsConstructor
public class SearchService {

    private final SearchMapper searchMapper;
    private final ParticipationEmployeeMapper participationEmployeeMapper;
    private final ChatRoomMapper chatRoomMapper;
    private final EmployeeMapper employeeMapper;

    public List<SearchEmployee> getEmployeeList(Long employeeId) {
        List<SearchEmployee> employeeList = searchMapper.getAllEmployeesInfo(employeeId);

        return employeeList;
    }

    /**
     * 회원이 참가하고 있는 그룹채팅방 이름 설정
     * chatRoomName이 null이면 참가해있는 사람들을 최대 5명까지 넣어서 채팅방 이름 생성
     * 설정된 채팅방 이름이 있으면 설정된 채팅방 이름으로 설정
     */

    public List<SearchChatRoom> getSearchChatRoom(Long employeeId) {
        List<Long> chatRoomList = searchMapper.getMyChatRooms(employeeId);
        List<SearchChatRoom> searchChatRoomList = new ArrayList<>();
        // 대화하기용 chatRoomList 저장

        StringBuilder participationEmployees = new StringBuilder();

        chatRoomList.forEach(chatRoomId -> {
            String chatRoomName = searchMapper.getRoomName(chatRoomId);
            if(chatRoomName == null) {
                List<Long> employeeIds = searchMapper.participationEmployeeFindByChatRoomId(chatRoomId);
                List<String> names = new ArrayList<>();

                int tmpEmployeeCount = 0;
                if(employeeIds.size() > 5) {
                    tmpEmployeeCount = 5;
                } else {
                    tmpEmployeeCount = employeeIds.size();
                }
                for(int i=0; i<tmpEmployeeCount; i++) {
                    EmployeeInfo employeeInfo = employeeMapper.getEmployeeInfo(employeeIds.get(i)).orElseThrow(() -> new NotFoundException("회원정보를 가져올 수 없습니다. - search Service"));
                    names.add(employeeInfo.getName());
                }
                // 이름 목록을 문자열로 변환하여 participationEmployees에 추가
                if (names != null && !names.isEmpty()) {
                    names.forEach(name -> {
                        participationEmployees.append(name).append(", "); // 각 이름 뒤에 쉼표 추가
                    });
                }

                if (participationEmployees.length() > 0) {
                    participationEmployees.setLength(participationEmployees.length() - 2); // 마지막 쉼표 및 공백 제거
                }
                participationEmployees.append("님과의 채팅");
                searchChatRoomList.add(new SearchChatRoom(participationEmployees.toString(), DEFAULT_GROUP_IMAGE, chatRoomId));
                participationEmployees.delete(0, participationEmployees.length());
            } else {
                searchChatRoomList.add(new SearchChatRoom(chatRoomName, DEFAULT_GROUP_IMAGE, chatRoomId));
            }
        });


        return searchChatRoomList;
    }


    public List<SearchEmployee> getChangeEmployeeList(Long employeeId, String keyword) {

        return searchMapper.getChangeAllEmployeesInfo(employeeId, keyword);
    }

    public List<SearchEmployee> getAllEmployees(Long employeeId, String keyword) {
        EmployeeInfo employeeInfo = employeeMapper.getEmployeeInfo(employeeId).orElseThrow(() -> new NotFoundException("회원의 아이디를 가져올 수 없습니다."));
        return searchMapper.getAllEmployeesInfoByKeyword(employeeInfo.getCompanyId(), keyword);
    }

    public List<SearchChatRoom> getChangeSearchChatRoom(Long employeeId, String keyword) {
        List<SearchChatRoom> searchChatRoomList = new ArrayList<>();

        List<Long> chatRoomList =  searchMapper.getChangeMyChatRooms(employeeId);
        StringBuilder participationEmployees = new StringBuilder();

        chatRoomList.forEach(chatRoomId -> {
            String chatRoomName = searchMapper.getRoomName(chatRoomId);
            if(chatRoomName == null) {

                List<Long> employeeIds = searchMapper.participationEmployeeFindByChatRoomId(chatRoomId);

                List<String> names = new ArrayList<>();

                int tmpEmployeeCount = 0;
                if(employeeIds.size() > 5) {
                    tmpEmployeeCount = 5;
                } else {
                    tmpEmployeeCount = employeeIds.size();
                }
                for(int i=0; i<tmpEmployeeCount; i++) {
                    EmployeeInfo employeeInfo = employeeMapper.getEmployeeInfo(employeeIds.get(i)).orElseThrow(() -> new NotFoundException("회원정보를 가져올 수 없습니다. - search Service"));
                    names.add(employeeInfo.getName());
                }

                // 이름 목록을 문자열로 변환하여 participationEmployees에 추가
                if (names != null && !names.isEmpty()) {
                    names.forEach(name -> {
                        participationEmployees.append(name).append(", "); // 각 이름 뒤에 쉼표 추가
                    });
                }

                if (participationEmployees.length() > 0) {
                    participationEmployees.setLength(participationEmployees.length() - 2); // 마지막 쉼표 및 공백 제거
                }

                if(participationEmployees.toString().contains(keyword)) {
                    participationEmployees.append("님과의 채팅");
                    searchChatRoomList.add(new SearchChatRoom(participationEmployees.toString(), DEFAULT_GROUP_IMAGE,chatRoomId));
                    participationEmployees.delete(0, participationEmployees.length());

                }else {
                    participationEmployees.delete(0, participationEmployees.length());

                }
            } else {
                if (chatRoomName.contains(keyword)) {
                    searchChatRoomList.add(new SearchChatRoom(chatRoomName, DEFAULT_GROUP_IMAGE,chatRoomId));
                }
            }

        });


        return searchChatRoomList;
    }
}